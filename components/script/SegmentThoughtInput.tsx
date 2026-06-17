"use client";

import { useState } from "react";
import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { generateText } from "@/lib/ai/providers";
import { buildThoughtIntegrationPrompt } from "@/lib/ai/prompts";
import { addFeedbackLog } from "@/lib/db/feedback-db";
import { getAggregatedPreferences } from "@/lib/personalization";
import type { ScriptSegment, Script } from "@/lib/types";
import { Lightbulb, Loader2, Send, X } from "lucide-react";
import { toast } from "sonner";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/components/ui/popover";

interface SegmentThoughtInputProps {
  segment: ScriptSegment;
  script: Script;
  audioTagsEnabled?: boolean;
}

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function SegmentThoughtInput({ segment, script, audioTagsEnabled = true }: SegmentThoughtInputProps) {
  const settings = useAppStore((s) => s.settings);
  const draft = useAppStore((s) => s.draft);
  const setCurrentScript = useAppStore((s) => s.setCurrentScript);
  const addVersion = useAppStore((s) => s.addVersion);

  const [open, setOpen] = useState(false);
  const [thought, setThought] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleIntegrate = async () => {
    const trimmed = thought.trim();
    if (!trimmed) {
      toast.error("Write a thought first.");
      return;
    }

    setIsLoading(true);
    try {
      const preferences = await getAggregatedPreferences();
      const { system, user } = buildThoughtIntegrationPrompt({
        segment,
        allSegments: script.segments,
        thought: trimmed,
        draft,
        preferences,
        audioTagsEnabled,
      });

      const raw = await generateText({
        settings,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.8,
      });

      const newText = raw.replace(/^["']|["']$/g, "").trim();
      if (!newText) throw new Error("AI returned empty text");

      const before = segment.text;

      const newScript = {
        ...script,
        id: generateId(),
        createdAt: Date.now(),
        segments: script.segments.map((s) =>
          s.id === segment.id ? { ...s, text: newText } : s
        ),
      };
      setCurrentScript(newScript);
      addVersion(newScript);

      await addFeedbackLog({
        scriptId: script.id,
        sessionId: generateId(),
        provider: settings.provider,
        model: settings.model,
        segmentType: segment.type,
        segmentId: segment.id,
        actionType: "thought:integrate",
        instruction: `Integrate thought: ${trimmed}`,
        before,
        after: newText,
        metadata: { tone: draft.tone, style: draft.style, length: draft.length },
      });

      setThought("");
      setOpen(false);
      toast.success("Thought integrated");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Integration failed";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className="inline-flex h-7 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Add a thought"
      >
        <Lightbulb className="h-3.5 w-3.5" />
        Add thought
      </PopoverTrigger>
      <PopoverContent className="w-80 sm:w-96" align="end" side="top">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Add a thought</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => setOpen(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
          <Textarea
            placeholder="e.g. I want to mention that it works offline without sounding defensive..."
            value={thought}
            onChange={(e) => setThought(e.target.value)}
            rows={3}
            disabled={isLoading}
            className="min-h-[80px] resize-y text-sm"
          />
          <div className="flex justify-end">
            <Button
              size="sm"
              className="gap-2"
              disabled={!thought.trim() || isLoading}
              onClick={handleIntegrate}
            >
              {isLoading ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Send className="h-3.5 w-3.5" />
              )}
              Integrate thought
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
