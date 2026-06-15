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
import { SelectionToolbar } from "@/components/script/SelectionToolbar";
import { SuggestionPanel } from "@/components/script/SuggestionPanel";
import { formatPreferenceSummary, getAggregatedPreferences } from "@/lib/personalization";
import { ArrowLeft, ArrowRight, Save, FileText, Volume2, RefreshCw } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { buildAudioTagPrompt, parseAudioTaggedSegmentsJson, stripAudioTags } from "@/lib/ai/prompts";
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

export function ReviewStep() {
  const currentScript = useAppStore((s) => s.currentScript);
  const setStep = useAppStore((s) => s.setStep);
  const addVersion = useAppStore((s) => s.addVersion);
  const setCurrentScript = useAppStore((s) => s.setCurrentScript);
  const audioTagsEnabled = useAppStore((s) => s.audioTagsEnabled);
  const setAudioTagsEnabled = useAppStore((s) => s.setAudioTagsEnabled);
  const draft = useAppStore((s) => s.draft);
  const settings = useAppStore((s) => s.settings);
  const setLoading = useAppStore((s) => s.setLoading);

  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [isRegeneratingTags, setIsRegeneratingTags] = useState(false);
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
        temperature: 0.8,
      });

      const parsed = parseAudioTaggedSegmentsJson(raw);
      if (!parsed || parsed.length === 0) {
        throw new Error("The AI returned an unexpected format.");
      }

      const taggedScript = {
        ...currentScript,
        id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`,
        createdAt: Date.now(),
        segments: currentScript.segments.map((segment) => {
          const tagged = parsed.find((p) => p.type === segment.type && p.text);
          return {
            ...segment,
            text: tagged ? tagged.text.trim() : segment.text,
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

  const handleToggleAudioTags = (enabled: boolean) => {
    setAudioTagsEnabled(enabled);
  };

  const totals = useMemo(() => {
    if (!currentScript) return { words: 0, chars: 0 };
    const text = currentScript.segments
      .map((s) => (audioTagsEnabled ? s.text : stripAudioTags(s.text)))
      .join(" ");
    return {
      words: countWords(text),
      chars: text.length,
    };
  }, [currentScript, audioTagsEnabled]);

  if (!currentScript) {
    return (
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-muted-foreground">No script yet. Go back and generate one.</p>
        <Button onClick={() => setStep("input")} className="mt-4 gap-2">
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
        <div className="space-y-4">
          {currentScript.segments.map((segment) => (
            <SegmentCard
              key={segment.id}
              segment={segment}
              script={currentScript}
              onSelectText={handleSelectText}
              audioTagsEnabled={audioTagsEnabled}
            />
          ))}
        </div>

        <div className="space-y-6">
          <GlobalControls />
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
