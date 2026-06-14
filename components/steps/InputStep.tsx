"use client";

import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ProviderSettings } from "@/components/providers/ProviderSettings";
import { Progress } from "@/components/ui/progress";
import { generateText } from "@/lib/ai/providers";
import { buildGenerationPrompt, parseScriptJson } from "@/lib/ai/prompts";
import { addFeedbackLog } from "@/lib/db/feedback-db";
import { getAggregatedPreferences } from "@/lib/personalization";
import type { ContentType, Script, Tone, Style } from "@/lib/types";
import { Sparkles, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { useMemo, useEffect } from "react";

const CONTENT_TYPES: { value: ContentType; label: string }[] = [
  { value: "tiktok", label: "TikTok / Reels" },
  { value: "youtube-shorts", label: "YouTube Shorts" },
  { value: "twitter-thread", label: "Twitter / X Thread" },
  { value: "linkedin-post", label: "LinkedIn Post" },
];

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

export function InputStep() {
  const draft = useAppStore((s) => s.draft);
  const settings = useAppStore((s) => s.settings);
  const setDraft = useAppStore((s) => s.setDraft);
  const setCurrentScript = useAppStore((s) => s.setCurrentScript);
  const addVersion = useAppStore((s) => s.addVersion);
  const setLoading = useAppStore((s) => s.setLoading);
  const setError = useAppStore((s) => s.setError);
  const setStep = useAppStore((s) => s.setStep);
  const isLoading = useAppStore((s) => s.isLoading);
  const loadingMessage = useAppStore((s) => s.loadingMessage);

  const isReady = useMemo(
    () => draft.brainDump.trim().length > 20,
    [draft.brainDump]
  );

  const handleGenerate = async () => {
    if (!isReady) {
      toast.error("Please write a bit more about your idea.");
      return;
    }

    setLoading(true, "Crafting your script...");
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
        throw new Error(
          "The AI returned an unexpected format. Please try again or switch providers."
        );
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
        actionType: "generation",
        metadata: {
          contentType: draft.contentType,
          tone: draft.tone,
          style: draft.style,
          length: draft.length,
        },
      });

      setStep("review");
      toast.success("Script generated!");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Generation failed";
      setError(message);
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter" && isReady && !isLoading) {
        e.preventDefault();
        handleGenerate();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isReady, isLoading]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">AI Content Studio</h1>
          <p className="text-sm text-muted-foreground sm:text-base">
            Describe your feature and let the AI draft scroll-stopping content.
          </p>
        </div>
        <ProviderSettings />
      </div>

      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>Describe & configure</span>
        <span>Step 1 of 3</span>
      </div>
      <Progress value={33} className="mb-8" />

      <div className="grid gap-6">
        <div className="grid gap-2">
          <Label htmlFor="brain-dump">Brain dump your idea</Label>
          <p className="text-sm text-muted-foreground">
            Dump everything here — what it is, who it helps, why it matters, random angles, quotes, anything. The AI will figure out the structure.
          </p>
          <Textarea
            id="brain-dump"
            placeholder={`e.g. I'm building a Chrome extension that summarizes long YouTube videos into key takeaways in one click. It saves busy learners 20+ minutes per video and helps them decide if a video is worth watching. Target audience is students and professionals who consume a lot of educational content but don't have time for fluff.`}
            value={draft.brainDump}
            onChange={(e) => setDraft({ brainDump: e.target.value })}
            rows={10}
            className="min-h-[200px] resize-y"
          />
        </div>

        <div className="grid gap-6 rounded-xl border bg-card p-4 sm:p-5">
          <h3 className="font-semibold">Content settings</h3>

          <div className="grid gap-2">
            <Label>Content type</Label>
            <Select
              value={draft.contentType}
              onValueChange={(v) => setDraft({ contentType: v as ContentType })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTENT_TYPES.map((ct) => (
                  <SelectItem key={ct.value} value={ct.value}>
                    {ct.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label>Tone</Label>
            <div className="flex flex-wrap gap-2">
              {TONES.map((t) => (
                <Button
                  key={t.value}
                  type="button"
                  variant={draft.tone === t.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDraft({ tone: t.value })}
                >
                  {t.label}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Style</Label>
            <div className="flex flex-wrap gap-2">
              {STYLES.map((s) => (
                <Button
                  key={s.value}
                  type="button"
                  variant={draft.style === s.value ? "default" : "outline"}
                  size="sm"
                  onClick={() => setDraft({ style: s.value })}
                >
                  {s.label}
                </Button>
              ))}
            </div>
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
        </div>

        <Button
          size="lg"
          onClick={handleGenerate}
          disabled={!isReady}
          className="gap-2"
        >
          {isLoading ? (
            <Wand2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          {isLoading ? loadingMessage : "Generate Script"}
        </Button>
      </div>
    </div>
  );
}
