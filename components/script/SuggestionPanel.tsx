"use client";

import { useState } from "react";
import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { generateText } from "@/lib/ai/providers";
import {
  buildRefinementPrompt,
  buildSuggestionsPrompt,
  parseSuggestionsJson,
} from "@/lib/ai/prompts";
import { addFeedbackLog } from "@/lib/db/feedback-db";
import { getAggregatedPreferences } from "@/lib/personalization";
import type { FeedbackActionType, ScriptSegment } from "@/lib/types";
import { X, Send, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface SuggestionPanelProps {
  segmentId: string;
  selectedText: string;
  initialMode: "suggestions" | "custom";
  onClose: () => void;
}

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function SuggestionPanel({
  segmentId,
  selectedText,
  initialMode,
  onClose,
}: SuggestionPanelProps) {
  const script = useAppStore((s) => s.currentScript);
  const settings = useAppStore((s) => s.settings);
  const draft = useAppStore((s) => s.draft);
  const updateSegmentText = useAppStore((s) => s.updateSegmentText);
  const setLoading = useAppStore((s) => s.setLoading);
  const addVersion = useAppStore((s) => s.addVersion);
  const setCurrentScript = useAppStore((s) => s.setCurrentScript);

  const [mode, setMode] = useState<"suggestions" | "custom">(initialMode);
  const [suggestions, setSuggestions] = useState<{ label: string; text: string }[]>([]);
  const [customPrompt, setCustomPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  if (!script) return null;
  const segment = script.segments.find((s) => s.id === segmentId);
  if (!segment) return null;

  const fetchSuggestions = async (instruction?: string) => {
    setIsLoading(true);
    try {
      const preferences = await getAggregatedPreferences();
      let raw = "";

      if (instruction) {
        const { system, user } = buildRefinementPrompt({
          segment,
          allSegments: script.segments,
          instruction,
          actionType: "selection:suggestions",
          draft,
          preferences,
        });
        raw = await generateText({
          settings,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0.85,
        });
        const text = raw.replace(/^["']|["']$/g, "").trim();
        setSuggestions([
          { label: "Option 1", text },
          { label: "Option 2", text },
          { label: "Option 3", text },
        ]);
      } else {
        const { system, user } = buildSuggestionsPrompt({
          segment,
          allSegments: script.segments,
          selectedText,
          draft,
          preferences,
        });
        raw = await generateText({
          settings,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0.9,
        });
        const parsed = parseSuggestionsJson(raw);
        setSuggestions(parsed || []);
      }

      await addFeedbackLog({
        scriptId: script.id,
        sessionId: generateId(),
        provider: settings.provider,
        model: settings.model,
        segmentType: segment.type,
        segmentId: segment.id,
        actionType: "selection:suggestions",
        selectedText,
        instruction,
        metadata: { tone: draft.tone, style: draft.style, length: draft.length },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Suggestions failed";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  const applySuggestion = async (text: string, actionType: FeedbackActionType) => {
    const before = segment.text;
    const newText = segment.text.replace(selectedText, text);
    updateSegmentText(segment.id, newText);

    // Create a new version to capture the change
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
      actionType,
      selectedText,
      before,
      after: newText,
      metadata: { tone: draft.tone, style: draft.style, length: draft.length },
    });

    toast.success("Suggestion applied");
    onClose();
  };

  const handleCustomPrompt = async () => {
    if (!customPrompt.trim()) return;
    setIsLoading(true);
    try {
      const preferences = await getAggregatedPreferences();
      const { system, user } = buildRefinementPrompt({
        segment,
        allSegments: script.segments,
        instruction: `Focus on this selected text: "${selectedText}". ${customPrompt}`,
        actionType: "selection:custom",
        draft,
        preferences,
      });
      const raw = await generateText({
        settings,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.85,
      });
      const text = raw.replace(/^["']|["']$/g, "").trim();
      await applySuggestion(text, "selection:custom");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Custom refinement failed";
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="fixed inset-x-2 bottom-2 z-50 mx-auto flex max-h-[min(80vh,600px)] max-w-2xl animate-in slide-in-from-bottom-10 flex-col overflow-hidden p-3 shadow-xl sm:inset-auto sm:bottom-6 sm:right-6 sm:left-auto sm:w-[420px] sm:p-4">
      <div className="mb-3 flex shrink-0 items-center justify-between">
        <div className="flex items-center gap-2 font-semibold">
          <Sparkles className="h-4 w-4 text-primary" />
          {mode === "suggestions" ? "AI suggestions" : "Custom improvement"}
        </div>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="mb-3 shrink-0 rounded-md bg-muted p-2 text-sm text-muted-foreground">
        <span className="font-medium text-foreground">Selected:</span> "{selectedText}"
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
      {mode === "suggestions" && (
        <div className="space-y-3">
          {suggestions.length === 0 && !isLoading && (
            <div className="text-center">
              <Button onClick={() => fetchSuggestions()} className="gap-2">
                <Sparkles className="h-4 w-4" />
                Get marketer suggestions
              </Button>
            </div>
          )}

          {isLoading && (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Thinking like a marketer...
            </div>
          )}

          {suggestions.map((s, idx) => (
            <div
              key={idx}
              className="group rounded-lg border p-3 transition-colors hover:border-primary hover:bg-primary/5"
            >
              <div className="mb-1 text-xs font-medium text-muted-foreground">
                {s.label}
              </div>
              <p className="mb-2 text-sm">{s.text}</p>
              <Button
                size="sm"
                variant="secondary"
                className="w-full"
                onClick={() => applySuggestion(s.text, "selection:apply")}
              >
                Apply this
              </Button>
            </div>
          ))}

          {suggestions.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => setMode("custom")}
            >
              None of these fit? Write your own prompt
            </Button>
          )}
        </div>
      )}

      {mode === "custom" && (
        <div className="space-y-3">
          <Textarea
            placeholder="e.g. Make it sound more urgent, add a specific number, remove the jargon..."
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            rows={3}
          />
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="flex-1"
              onClick={() => setMode("suggestions")}
            >
              Back
            </Button>
            <Button
              size="sm"
              className="flex-1 gap-2"
              disabled={!customPrompt.trim() || isLoading}
              onClick={handleCustomPrompt}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
              Send
            </Button>
          </div>
        </div>
      )}
      </div>
    </Card>
  );
}
