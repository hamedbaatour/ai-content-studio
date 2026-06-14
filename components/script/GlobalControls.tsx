"use client";

import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generateText } from "@/lib/ai/providers";
import { buildGenerationPrompt, parseScriptJson } from "@/lib/ai/prompts";
import { addFeedbackLog } from "@/lib/db/feedback-db";
import { getAggregatedPreferences } from "@/lib/personalization";
import type { Tone, Style, Script } from "@/lib/types";
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";

const TONES: { value: Tone; label: string }[] = [
  { value: "casual", label: "Casual" },
  { value: "professional", label: "Professional" },
  { value: "hype", label: "Hype" },
  { value: "inspirational", label: "Inspirational" },
  { value: "witty", label: "Witty" },
];

const STYLES: { value: Style; label: string }[] = [
  { value: "direct", label: "Direct" },
  { value: "story", label: "Story" },
  { value: "listicle", label: "Listicle" },
  { value: "educational", label: "Educational" },
  { value: "dramatic", label: "Dramatic" },
];

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function GlobalControls() {
  const draft = useAppStore((s) => s.draft);
  const settings = useAppStore((s) => s.settings);
  const currentScript = useAppStore((s) => s.currentScript);
  const setDraft = useAppStore((s) => s.setDraft);
  const setCurrentScript = useAppStore((s) => s.setCurrentScript);
  const addVersion = useAppStore((s) => s.addVersion);
  const setLoading = useAppStore((s) => s.setLoading);

  const handleApplyGlobal = async () => {
    if (!currentScript) return;
    setLoading(true, "Applying global adjustments...");
    try {
      const preferences = await getAggregatedPreferences();
      const { system, user } = buildGenerationPrompt({ draft, preferences });
      const raw = await generateText({
        settings,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.85,
      });

      const parsed = parseScriptJson(raw);
      if (!parsed || parsed.segments.length === 0) {
        throw new Error("The AI returned an unexpected format.");
      }

      const script: Script = {
        id: generateId(),
        title: parsed.title,
        segments: parsed.segments.map((seg, idx) => ({
          id: `${generateId()}-${idx}`,
          type: seg.type,
          text: seg.text,
        })),
        createdAt: Date.now(),
        provider: settings.provider,
        model: settings.model,
      };

      setCurrentScript(script);
      addVersion(script);

      await addFeedbackLog({
        scriptId: script.id,
        sessionId: generateId(),
        provider: settings.provider,
        model: settings.model,
        actionType: "global:tone",
        metadata: {
          tone: draft.tone,
          style: draft.style,
          length: draft.length,
        },
      });

      toast.success("Script regenerated with new settings");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Regeneration failed";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-5 rounded-xl border bg-card p-4 shadow-sm sm:p-5 lg:sticky lg:top-4 lg:z-10">
      <div className="flex items-center justify-between">
        <h3 className="font-semibold">Global adjustments</h3>
      </div>

      <div className="grid gap-2">
        <Label>Tone</Label>
        <Select
          value={draft.tone}
          onValueChange={(v) => setDraft({ tone: v as Tone })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {TONES.map((t) => (
              <SelectItem key={t.value} value={t.value}>
                {t.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-2">
        <Label>Style</Label>
        <Select
          value={draft.style}
          onValueChange={(v) => setDraft({ style: v as Style })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {STYLES.map((s) => (
              <SelectItem key={s.value} value={s.value}>
                {s.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid gap-4">
        <div className="flex items-center justify-between">
          <Label>Target length</Label>
          <span className="text-sm font-medium text-foreground">
            {draft.length} seconds
          </span>
        </div>
        <Slider
          value={draft.length}
          onValueChange={(v) => setDraft({ length: typeof v === "number" ? v : (v as number[])[0] })}
          min={15}
          max={90}
          step={15}
        />
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>15s</span>
          <span>30s</span>
          <span>45s</span>
          <span>60s</span>
          <span>75s</span>
          <span>90s</span>
        </div>
      </div>

      <Button onClick={handleApplyGlobal} className="w-full gap-2">
        <RefreshCw className="h-4 w-4" />
        Apply & Regenerate
      </Button>

      <p className="text-xs text-muted-foreground">
        Changes are saved locally and influence future AI output through your
        feedback history.
      </p>
    </div>
  );
}
