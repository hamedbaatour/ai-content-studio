"use client";

import { useState, useMemo } from "react";
import { useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverDescription,
} from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { generateText } from "@/lib/ai/providers";
import {
  buildRefinementPrompt,
  buildSegmentVariationsPrompt,
  buildVisualPrompt,
  instructionFromActionType,
  parseVariationsJson,
} from "@/lib/ai/prompts";
import { addFeedbackLog } from "@/lib/db/feedback-db";
import { getAggregatedPreferences } from "@/lib/personalization";
import type {
  ScriptSegment,
  Script,
  FeedbackActionType,
} from "@/lib/types";
import {
  ThumbsDown,
  Smile,
  Rocket,
  ArrowDownWideNarrow,
  ArrowUpWideNarrow,
  Laugh,
  Loader2,
  Sparkles,
  Copy,
  X,
  History,
  Image,
  Video,
  Type,
  Film,
  MousePointer,
  MonitorPlay,
  Clapperboard,
  Focus,
  ChevronDown,
} from "lucide-react";
import { SegmentThoughtInput } from "./SegmentThoughtInput";
import { toast } from "sonner";
import { useRef, useCallback } from "react";

interface SegmentCardProps {
  segment: ScriptSegment;
  script: Script;
  onSelectText: (segmentId: string, rect: DOMRect, text: string) => void;
}

const QUICK_ACTIONS: {
  action: FeedbackActionType;
  label: string;
  icon: React.ReactNode;
}[] = [
  { action: "refinement:shorter", label: "Shorter", icon: <ArrowDownWideNarrow className="h-3.5 w-3.5" /> },
  { action: "refinement:longer", label: "Longer", icon: <ArrowUpWideNarrow className="h-3.5 w-3.5" /> },
  { action: "refinement:less_cheesy", label: "Less cheesy", icon: <Laugh className="h-3.5 w-3.5" /> },
  { action: "refinement:more_human", label: "More human", icon: <Smile className="h-3.5 w-3.5" /> },
  { action: "refinement:more_hypey", label: "More hypey", icon: <Rocket className="h-3.5 w-3.5" /> },
  { action: "refinement:dont_like", label: "Don’t like this", icon: <ThumbsDown className="h-3.5 w-3.5" /> },
];

const SEGMENT_LABELS: Record<ScriptSegment["type"], string> = {
  hook: "Hook",
  problem: "Problem",
  solution: "Solution",
  benefit: "Benefit",
  proof: "Proof",
  objection: "Objection",
  cta: "Call to Action",
};

const VISUAL_PROMPT_STYLES: { label: string; icon: React.ReactNode }[] = [
  { label: "Another concept", icon: <Sparkles className="h-3 w-3" /> },
  { label: "Faceless asset", icon: <Image className="h-3 w-3" /> },
  { label: "Text graphic", icon: <Type className="h-3 w-3" /> },
  { label: "Cinematic action", icon: <Film className="h-3 w-3" /> },
  { label: "Pointing at screen", icon: <MousePointer className="h-3 w-3" /> },
  { label: "Screen recording", icon: <MonitorPlay className="h-3 w-3" /> },
  { label: "B-roll", icon: <Clapperboard className="h-3 w-3" /> },
  { label: "Close-up product", icon: <Focus className="h-3 w-3" /> },
];

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function countWords(text: string): number {
  return text.trim() === "" ? 0 : text.trim().split(/\s+/).length;
}

function tokenize(text: string): string[] {
  return text.split(/(\s+)/).filter((t) => t.length > 0);
}

function lcsIndices(a: string[], b: string[]): { aIdx: number; bIdx: number }[] {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const matches: { aIdx: number; bIdx: number }[] = [];
  let i = m;
  let j = n;
  while (i > 0 && j > 0) {
    if (a[i - 1] === b[j - 1]) {
      matches.unshift({ aIdx: i - 1, bIdx: j - 1 });
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }
  return matches;
}

interface DiffToken {
  text: string;
  type: "same" | "add" | "remove";
}

function buildOldDiff(oldText: string, newText: string): DiffToken[] {
  const oldTokens = tokenize(oldText);
  const newTokens = tokenize(newText);
  const matches = lcsIndices(oldTokens, newTokens);
  const matchedOld = new Set(matches.map((m) => m.aIdx));

  return oldTokens.map((token, idx) => ({
    text: token,
    type: matchedOld.has(idx) ? "same" : "remove",
  }));
}

function buildNewDiff(oldText: string, newText: string): DiffToken[] {
  const oldTokens = tokenize(oldText);
  const newTokens = tokenize(newText);
  const matches = lcsIndices(oldTokens, newTokens);
  const matchedNew = new Set(matches.map((m) => m.bIdx));

  return newTokens.map((token, idx) => ({
    text: token,
    type: matchedNew.has(idx) ? "same" : "add",
  }));
}

function DiffView({ oldText, newText }: { oldText: string; newText: string }) {
  const oldTokens = buildOldDiff(oldText, newText);
  const newTokens = buildNewDiff(oldText, newText);

  return (
    <div className="grid grid-cols-2 gap-2 text-xs">
      <div className="rounded border bg-muted/40 p-2">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Previous
        </div>
        <p className="leading-relaxed">
          {oldTokens.map((token, idx) => (
            <span
              key={idx}
              className={
                token.type === "remove"
                  ? "rounded bg-red-100 px-0.5 text-red-700 line-through dark:bg-red-900/30 dark:text-red-300"
                  : undefined
              }
            >
              {token.text}
            </span>
          ))}
        </p>
      </div>
      <div className="rounded border bg-muted/40 p-2">
        <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
          Current
        </div>
        <p className="leading-relaxed">
          {newTokens.map((token, idx) => (
            <span
              key={idx}
              className={
                token.type === "add"
                  ? "rounded bg-green-100 px-0.5 text-green-700 dark:bg-green-900/30 dark:text-green-300"
                  : undefined
              }
            >
              {token.text}
            </span>
          ))}
        </p>
      </div>
    </div>
  );
}

function formatVersionTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function SegmentCard({ segment, script, onSelectText }: SegmentCardProps) {
  const settings = useAppStore((s) => s.settings);
  const draft = useAppStore((s) => s.draft);
  const updateSegmentText = useAppStore((s) => s.updateSegmentText);
  const updateSegmentVisualPrompt = useAppStore((s) => s.updateSegmentVisualPrompt);
  const setCurrentScript = useAppStore((s) => s.setCurrentScript);
  const addVersion = useAppStore((s) => s.addVersion);
  const versions = useAppStore((s) => s.versions);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const [isLoading, setIsLoading] = useState(false);
  const [loadingLabel, setLoadingLabel] = useState("");
  const [variations, setVariations] = useState<{ label: string; text: string }[] | null>(null);
  const [historyDialogOpen, setHistoryDialogOpen] = useState(false);
  const [isVisualOpen, setIsVisualOpen] = useState(false);
  const [isGeneratingVisual, setIsGeneratingVisual] = useState(false);

  const segmentHistory = useMemo(() => {
    return versions
      .filter((v) => v.id !== script.id)
      .map((v) => {
        const s = v.segments.find((seg) => seg.id === segment.id);
        return s ? { script: v, segment: s } : null;
      })
      .filter(
        (item): item is { script: Script; segment: ScriptSegment } =>
          !!item && item.segment.text !== segment.text
      );
  }, [versions, script.id, segment.id, segment.text]);

  const historyCount = segmentHistory.length;
  const hasHistory = historyCount > 0;
  const latestHistory = segmentHistory[0];

  const runRefinement = async (
    action: FeedbackActionType,
    customInstruction?: string,
    label?: string
  ) => {
    setIsLoading(true);
    setLoadingLabel(label || "Refining...");
    try {
      const preferences = await getAggregatedPreferences();
      const instruction = customInstruction || instructionFromActionType(action);
      const { system, user } = buildRefinementPrompt({
        segment,
        allSegments: script.segments,
        instruction,
        actionType: action,
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

      const newText = raw.replace(/^["']|["']$/g, "").trim();
      if (!newText) throw new Error("AI returned empty text");

      const before = segment.text;
      updateSegmentText(segment.id, newText);

      await addFeedbackLog({
        scriptId: script.id,
        sessionId: generateId(),
        provider: settings.provider,
        model: settings.model,
        segmentType: segment.type,
        segmentId: segment.id,
        actionType: action,
        instruction,
        before,
        after: newText,
        metadata: { tone: draft.tone, style: draft.style, length: draft.length },
      });

      toast.success("Segment updated");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Refinement failed";
      toast.error(message);
    } finally {
      setIsLoading(false);
      setLoadingLabel("");
    }
  };

  const handleQuickAction = (action: FeedbackActionType) => {
    const label = QUICK_ACTIONS.find((qa) => qa.action === action)?.label;
    runRefinement(action, undefined, label);
  };

  const generateVariations = async () => {
    setIsLoading(true);
    setLoadingLabel("Generating variations...");
    try {
      const preferences = await getAggregatedPreferences();
      const { system, user } = buildSegmentVariationsPrompt({
        segment,
        allSegments: script.segments,
        draft,
        preferences,
      });

      const raw = await generateText({
        settings,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        temperature: 0.9,
      });

      const parsed = parseVariationsJson(raw);
      const variants = parsed && parsed.length > 0 ? parsed : [];

      if (variants.length === 0) {
        throw new Error("No variations returned. Try again or switch providers.");
      }

      setVariations(variants);

      await addFeedbackLog({
        scriptId: script.id,
        sessionId: generateId(),
        provider: settings.provider,
        model: settings.model,
        segmentType: segment.type,
        segmentId: segment.id,
        actionType: "refinement:custom",
        instruction: "Generate segment variations",
        metadata: { tone: draft.tone, style: draft.style, length: draft.length },
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Variations failed";
      toast.error(message);
    } finally {
      setIsLoading(false);
      setLoadingLabel("");
    }
  };

  const applyVariation = (text: string) => {
    const before = segment.text;
    updateSegmentText(segment.id, text);

    const newScript = {
      ...script,
      id: generateId(),
      createdAt: Date.now(),
      segments: script.segments.map((s) =>
        s.id === segment.id ? { ...s, text } : s
      ),
    };
    setCurrentScript(newScript);
    addVersion(newScript);

    addFeedbackLog({
      scriptId: script.id,
      sessionId: generateId(),
      provider: settings.provider,
      model: settings.model,
      segmentType: segment.type,
      segmentId: segment.id,
      actionType: "selection:apply",
      before,
      after: text,
      metadata: { tone: draft.tone, style: draft.style, length: draft.length },
    });

    setVariations(null);
    toast.success("Variation applied");
  };

  const handleTextChange = (value: string) => {
    updateSegmentText(segment.id, value);
  };

  const handleVisualPromptChange = (value: string) => {
    updateSegmentVisualPrompt(segment.id, value);
  };

  const generateVisualPrompt = async (style: string) => {
    setIsGeneratingVisual(true);
    try {
      const { system, user } = buildVisualPrompt({
        segment,
        allSegments: script.segments,
        style,
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
      if (!newVisualPrompt) throw new Error("AI returned empty visual prompt");

      updateSegmentVisualPrompt(segment.id, newVisualPrompt);

      await addFeedbackLog({
        scriptId: script.id,
        sessionId: generateId(),
        provider: settings.provider,
        model: settings.model,
        segmentType: segment.type,
        segmentId: segment.id,
        actionType: "refinement:custom",
        instruction: `Generate visual prompt: ${style}`,
        before: segment.visualPrompt,
        after: newVisualPrompt,
        metadata: { tone: draft.tone, style: draft.style, length: draft.length },
      });

      toast.success("Visual prompt updated");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Visual prompt failed";
      toast.error(message);
    } finally {
      setIsGeneratingVisual(false);
    }
  };

  const handleMouseUp = useCallback(() => {
    const selection = window.getSelection();
    if (!selection || selection.isCollapsed) return;
    const text = selection.toString().trim();
    if (!text) return;

    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    onSelectText(segment.id, rect, text);
  }, [segment.id, onSelectText]);

  const words = countWords(segment.text);
  const chars = segment.text.length;

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <CardHeader className="flex flex-col gap-3 bg-muted/30 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="font-medium">
            {SEGMENT_LABELS[segment.type]}
          </Badge>
          {hasHistory && latestHistory && (
            <>
              <Popover>
                <PopoverTrigger
                  className="flex items-center rounded-full p-1 hover:bg-muted"
                  aria-label={`Changed in ${historyCount} previous version${historyCount === 1 ? "" : "s"}`}
                >
                  <span className="block h-2 w-2 rounded-full bg-primary" />
                </PopoverTrigger>
                <PopoverContent className="w-80" side="top" align="start">
                  <PopoverHeader>
                    <PopoverTitle className="flex items-center gap-1.5 text-sm">
                      <History className="h-3.5 w-3.5 text-primary" />
                      Changed in {historyCount} previous version{historyCount === 1 ? "" : "s"}
                    </PopoverTitle>
                    <PopoverDescription className="text-xs">
                      Latest change compared to the current {SEGMENT_LABELS[segment.type].toLowerCase()}.
                    </PopoverDescription>
                  </PopoverHeader>
                  <DiffView oldText={latestHistory.segment.text} newText={segment.text} />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto w-full justify-start px-1 py-1 text-xs text-primary"
                    onClick={() => setHistoryDialogOpen(true)}
                  >
                    Show all previous versions
                  </Button>
                </PopoverContent>
              </Popover>

              <Dialog open={historyDialogOpen} onOpenChange={setHistoryDialogOpen}>
                <DialogContent className="max-h-[80vh] sm:max-w-lg">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <History className="h-4 w-4 text-primary" />
                      {SEGMENT_LABELS[segment.type]} history
                    </DialogTitle>
                    <DialogDescription>
                      {historyCount} previous version{historyCount === 1 ? "" : "s"} of this segment.
                    </DialogDescription>
                  </DialogHeader>
                  <ScrollArea className="h-[50vh] pr-3">
                    <div className="space-y-3">
                      {segmentHistory.map((item) => (
                        <div
                          key={item.script.id}
                          className="rounded-lg border bg-muted/30 p-3"
                        >
                          <div className="mb-2 flex items-center justify-between">
                            <span className="text-xs text-muted-foreground">
                              {formatVersionTime(item.script.createdAt)}
                            </span>
                            <Badge variant="outline" className="text-[10px]">
                              {item.script.provider} · {item.script.model}
                            </Badge>
                          </div>
                          <p className="text-sm leading-relaxed text-foreground">
                            {item.segment.text}
                          </p>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </DialogContent>
              </Dialog>
            </>
          )}
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 px-2 text-xs"
            onClick={generateVariations}
            disabled={isLoading}
          >
            {isLoading && loadingLabel.includes("variations") ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            Variations
          </Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {QUICK_ACTIONS.map((qa) => (
            <Button
              key={qa.action}
              variant="ghost"
              size="sm"
              className="h-7 gap-1 px-2 text-xs"
              onClick={() => handleQuickAction(qa.action)}
              disabled={isLoading}
            >
              {qa.icon}
              {qa.label}
            </Button>
          ))}
        </div>
      </CardHeader>

      <SegmentThoughtInput segment={segment} script={script} />

      <CardContent className="relative p-0">
        {isLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-[1px]">
            <div className="flex items-center gap-2 rounded-lg border bg-card px-4 py-2 shadow-sm">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span className="text-sm font-medium">{loadingLabel}</span>
            </div>
          </div>
        )}
        <Textarea
          ref={textareaRef}
          value={segment.text}
          onChange={(e) => handleTextChange(e.target.value)}
          onMouseUp={handleMouseUp}
          onKeyUp={handleMouseUp}
          className="min-h-[120px] resize-y rounded-none border-0 px-4 py-4 text-base leading-relaxed focus-visible:ring-0 focus-visible:ring-offset-0"
          spellCheck={false}
        />
      </CardContent>

      <div className="border-t bg-muted/20">
        <div className="flex items-center px-4 py-2">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 px-2 text-xs"
            onClick={() => setIsVisualOpen((v) => !v)}
            disabled={isGeneratingVisual}
          >
            <Video className="h-3.5 w-3.5" />
            {isVisualOpen ? "Close visual prompt" : "Visual prompt"}
            <ChevronDown
              className={cn(
                "h-3 w-3 transition-transform",
                isVisualOpen && "rotate-180"
              )}
            />
          </Button>
        </div>

        {isVisualOpen && (
          <div className="space-y-3 border-t px-4 py-3">
            <Textarea
              placeholder="Describe what appears on screen for this segment..."
              value={segment.visualPrompt}
              onChange={(e) => handleVisualPromptChange(e.target.value)}
              rows={2}
              disabled={isGeneratingVisual}
              className="min-h-[80px] resize-y text-sm"
            />
            <div className="flex flex-wrap gap-1.5">
              {VISUAL_PROMPT_STYLES.map((style) => (
                <Button
                  key={style.label}
                  variant="outline"
                  size="xs"
                  className="gap-1"
                  disabled={isGeneratingVisual}
                  onClick={() => generateVisualPrompt(style.label)}
                >
                  {isGeneratingVisual ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    style.icon
                  )}
                  {style.label}
                </Button>
              ))}
            </div>
          </div>
        )}
      </div>

      {variations && (
        <div className="border-t bg-muted/30 px-4 py-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {SEGMENT_LABELS[segment.type]} variations
            </span>
            <Button variant="ghost" size="sm" className="h-6 gap-1.5 px-2 text-xs" onClick={() => setVariations(null)}>
              <X className="h-3 w-3" />
              Dismiss
            </Button>
          </div>
          <div className="space-y-2">
            {variations.map((variant, idx) => (
              <Button
                key={idx}
                variant="outline"
                className="h-auto w-full justify-start gap-2 whitespace-normal px-3 py-2 text-left text-sm font-normal"
                onClick={() => applyVariation(variant.text)}
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="flex-1">
                  <span className="block text-xs font-medium text-muted-foreground">{variant.label}</span>
                  <span>{variant.text}</span>
                </span>
              </Button>
            ))}
          </div>
        </div>
      )}

      <CardFooter className="flex justify-end gap-3 border-t bg-muted/20 px-4 py-2 text-xs text-muted-foreground">
        <span>{words} word{words !== 1 ? "s" : ""}</span>
        <span>·</span>
        <span>{chars} char{chars !== 1 ? "s" : ""}</span>
      </CardFooter>
    </Card>
  );
}
