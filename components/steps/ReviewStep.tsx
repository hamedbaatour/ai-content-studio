"use client";

import { useState, useCallback, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { SegmentCard } from "@/components/script/SegmentCard";
import { GlobalControls } from "@/components/script/GlobalControls";
import { VersionHistory } from "@/components/script/VersionHistory";
import { NotesCard } from "@/components/script/NotesCard";
import { SelectionToolbar } from "@/components/script/SelectionToolbar";
import { SuggestionPanel } from "@/components/script/SuggestionPanel";
import { formatPreferenceSummary, getAggregatedPreferences } from "@/lib/personalization";
import {
  ArrowLeft,
  ArrowRight,
  Save,
  FileText,
  Volume2,
  RefreshCw,
  Video,
  Sparkles,
  FileX2,
  Clock,
} from "lucide-react";
import { Switch } from "@/components/ui/switch";
import {
  buildAudioTagPrompt,
  buildVisualPrompt,
  parseAudioTaggedSegmentsJson,
  stripAudioTags,
} from "@/lib/ai/prompts";
import { generateText } from "@/lib/ai/providers";

interface SelectionState {
  segmentId: string;
  text: string;
  rect: DOMRect;
  mode: "suggestions" | "custom";
}

function countWords(text: string): number {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

function estimateSeconds(text: string): number {
  const words = countWords(text);
  return Math.max(1, Math.round(words / 2.5));
}

function formatTime(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  if (m > 0) return `${m}:${s.toString().padStart(2, "0")}`;
  return `${s}s`;
}

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

export function ReviewStep() {
  const currentScript = useAppStore((s) => s.currentScript);
  const setStep = useAppStore((s) => s.setStep);
  const addVersion = useAppStore((s) => s.addVersion);
  const setCurrentScript = useAppStore((s) => s.setCurrentScript);
  const audioTagsEnabled = useAppStore((s) => s.audioTagsEnabled);
  const setAudioTagsEnabled = useAppStore((s) => s.setAudioTagsEnabled);
  const showVisualPrompts = useAppStore((s) => s.showVisualPrompts);
  const setShowVisualPrompts = useAppStore((s) => s.setShowVisualPrompts);
  const draft = useAppStore((s) => s.draft);
  const settings = useAppStore((s) => s.settings);
  const setLoading = useAppStore((s) => s.setLoading);
  const addAudioTagVariation = useAppStore((s) => s.addAudioTagVariation);
  const updateSegmentVisualPrompt = useAppStore((s) => s.updateSegmentVisualPrompt);

  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [isRegeneratingTags, setIsRegeneratingTags] = useState(false);
  const [isGeneratingAllVisuals, setIsGeneratingAllVisuals] = useState(false);
  const [prefsSummary, setPrefsSummary] = useState("Loading preferences...");

  useEffect(() => {
    getAggregatedPreferences().then((prefs) => {
      setPrefsSummary(formatPreferenceSummary(prefs));
    });
  }, [currentScript?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelection(null);
        window.getSelection()?.removeAllRanges();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleSelectText = useCallback(
    (segmentId: string, rect: DOMRect, text: string) => {
      setSelection({ segmentId, text, rect, mode: "suggestions" });
    },
    []
  );

  const clearSelection = useCallback(() => {
    setSelection(null);
    window.getSelection()?.removeAllRanges();
  }, []);

  const handleSaveSnapshot = () => {
    if (!currentScript) return;
    const snapshot = {
      ...currentScript,
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
      createdAt: Date.now(),
    };
    setCurrentScript(snapshot);
    addVersion(snapshot);
  };

  const handleRegenerateAudioTags = async () => {
    if (!currentScript) return;
    setIsRegeneratingTags(true);
    setLoading(true, "Regenerating audio tags...");
    try {
      const preferences = await getAggregatedPreferences();
      const { system, user } = buildAudioTagPrompt({
        script: currentScript,
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

      const parsed = parseAudioTaggedSegmentsJson(raw);
      if (!parsed || parsed.length === 0) {
        throw new Error("The AI returned an unexpected format.");
      }

      const taggedScript = {
        ...currentScript,
        id: generateId(),
        createdAt: Date.now(),
        segments: currentScript.segments.map((segment) => {
          const tagged = parsed.find((p) => p.type === segment.type && p.text);
          const newText = tagged ? tagged.text.trim() : segment.text;
          if (tagged && newText !== segment.text) {
            addAudioTagVariation(segment.id, newText);
          }
          return {
            ...segment,
            text: newText,
          };
        }),
      };

      setCurrentScript(taggedScript);
      addVersion(taggedScript);
      toast.success("Audio tags regenerated");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Audio tag regeneration failed";
      toast.error(message);
    } finally {
      setIsRegeneratingTags(false);
      setLoading(false);
    }
  };

  const handleGenerateAllVisuals = async () => {
    if (!currentScript) return;
    setIsGeneratingAllVisuals(true);
    setLoading(true, "Generating visual prompts...");
    try {
      let updated = { ...currentScript };
      for (let i = 0; i < currentScript.segments.length; i++) {
        const segment = currentScript.segments[i];
        if (segment.visualPrompt.trim()) continue;

        const { system, user } = buildVisualPrompt({
          segment,
          allSegments: updated.segments,
          style: "Another concept",
          draft,
        });

        const raw = await generateText({
          settings,
          messages: [
            { role: "system", content: system },
            { role: "user", content: user },
          ],
          temperature: 0.8,
        });

        const newVisualPrompt = raw.replace(/^["']|["']$/g, "").trim();
        if (newVisualPrompt) {
          updateSegmentVisualPrompt(segment.id, newVisualPrompt);
          updated = {
            ...updated,
            segments: updated.segments.map((s) =>
              s.id === segment.id ? { ...s, visualPrompt: newVisualPrompt } : s
            ),
          };
        }
      }

      const newScript = { ...updated, id: generateId(), createdAt: Date.now() };
      setCurrentScript(newScript);
      addVersion(newScript);
      toast.success("Visual prompts generated");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Visual prompt generation failed";
      toast.error(message);
    } finally {
      setIsGeneratingAllVisuals(false);
      setLoading(false);
    }
  };

  const handleToggleAudioTags = (enabled: boolean) => {
    setAudioTagsEnabled(enabled);
  };

  const totals = useMemo(() => {
    if (!currentScript) return { words: 0, chars: 0, seconds: 0 };
    const text = currentScript.segments
      .map((s) => (audioTagsEnabled ? s.text : stripAudioTags(s.text)))
      .join(" ");
    return {
      words: countWords(text),
      chars: text.length,
      seconds: currentScript.segments.reduce((acc, s) => acc + estimateSeconds(s.text), 0),
    };
  }, [currentScript, audioTagsEnabled]);

  const timeline = useMemo(() => {
    if (!currentScript) return [];
    let elapsed = 0;
    return currentScript.segments.map((segment) => {
      const start = elapsed;
      const seconds = estimateSeconds(segment.text);
      elapsed += seconds;
      return { segment, start, seconds, end: elapsed };
    });
  }, [currentScript]);

  if (!currentScript) {
    return (
      <div className="mx-auto flex max-w-md flex-col items-center text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-muted">
          <FileX2 className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold tracking-tight">No script yet</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Start by describing your idea. The AI will draft a script you can review and refine here.
        </p>
        <Button onClick={() => setStep("input")} className="mt-6 gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to input
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">
            {currentScript.title}
          </h2>
          <p className="text-sm text-muted-foreground">
            {prefsSummary}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline" className="gap-1.5 font-normal">
            <FileText className="h-3.5 w-3.5" />
            {totals.words} words · {totals.chars} chars
          </Badge>
          <Badge variant="outline" className="gap-1.5 font-normal">
            <Clock className="h-3.5 w-3.5" />
            ~{formatTime(totals.seconds)}
          </Badge>
          <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5">
            <Volume2 className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium">Audio tags</span>
            <Switch
              checked={audioTagsEnabled}
              onCheckedChange={handleToggleAudioTags}
              size="sm"
              aria-label="Toggle audio tags"
            />
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5">
            <Video className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium">Visuals</span>
            <Switch
              checked={showVisualPrompts}
              onCheckedChange={setShowVisualPrompts}
              size="sm"
              aria-label="Toggle visual prompts"
            />
          </div>
          {audioTagsEnabled && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleRegenerateAudioTags}
              disabled={isRegeneratingTags}
              className="gap-2"
            >
              {isRegeneratingTags ? (
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              Regenerate audio tags
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleGenerateAllVisuals}
            disabled={isGeneratingAllVisuals}
            className="gap-2"
          >
            {isGeneratingAllVisuals ? (
              <Sparkles className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            Generate visuals
          </Button>
          <Button variant="outline" size="sm" onClick={handleSaveSnapshot} className="gap-2">
            <Save className="h-4 w-4" />
            Save snapshot
          </Button>
          <Button size="sm" onClick={() => setStep("export")} className="gap-2">
            Export
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>Review & refine</span>
        <span>Step 2 of 3</span>
      </div>
      <Progress value={66} className="mb-8" />

      <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="space-y-0">
          {timeline.map(({ segment, start, seconds, end }, idx) => {
            const isLast = idx === timeline.length - 1;
            return (
              <div key={segment.id} className="group relative flex gap-4">
                <div className="flex w-14 flex-col items-end pt-3 text-right">
                  <span className="text-xs font-medium tabular-nums text-foreground">
                    {formatTime(start)}
                  </span>
                  <span className="text-[10px] text-muted-foreground">
                    +{seconds}s
                  </span>
                </div>
                <div className="relative flex flex-1 pb-4">
                  <div className="absolute bottom-0 left-0 top-3 w-px bg-border group-last:bottom-auto group-last:h-4" />
                  <div className="absolute left-[-3px] top-3 h-1.5 w-1.5 rounded-full bg-muted-foreground ring-2 ring-background" />
                  <div className="flex-1 pl-6">
                    <SegmentCard
                      segment={segment}
                      script={currentScript}
                      onSelectText={handleSelectText}
                      audioTagsEnabled={audioTagsEnabled}
                      showVisualPrompts={showVisualPrompts}
                      timelineEnd={isLast ? formatTime(end) : undefined}
                    />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="space-y-6">
          <GlobalControls />
          <NotesCard />
          <VersionHistory />
        </div>
      </div>

      {selection && !document.querySelector("[data-suggestion-panel]") && (
        <SelectionToolbar
          rect={selection.rect}
          onImprove={() => setSelection({ ...selection, mode: "suggestions" })}
          onPunchier={() => setSelection({ ...selection, mode: "suggestions" })}
          onSimpler={() => setSelection({ ...selection, mode: "suggestions" })}
          onCustom={() => setSelection({ ...selection, mode: "custom" })}
        />
      )}

      {selection && (
        <div data-suggestion-panel>
          <SuggestionPanel
            segmentId={selection.segmentId}
            selectedText={selection.text}
            initialMode={selection.mode}
            onClose={clearSelection}
          />
        </div>
      )}
    </div>
  );
}
