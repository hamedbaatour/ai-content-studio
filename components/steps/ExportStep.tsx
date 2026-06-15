"use client";

import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { ArrowLeft, RotateCcw, Copy, Download, Check } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Checkbox } from "@/components/ui/checkbox";
import { stripAudioTags } from "@/lib/ai/prompts";

export function ExportStep() {
  const currentScript = useAppStore((s) => s.currentScript);
  const setStep = useAppStore((s) => s.setStep);
  const resetDraft = useAppStore((s) => s.resetDraft);
  const audioTagsEnabled = useAppStore((s) => s.audioTagsEnabled);
  const [copied, setCopied] = useState(false);
  const [includeVisualPrompts, setIncludeVisualPrompts] = useState(false);
  const [includeAudioTags, setIncludeAudioTags] = useState(audioTagsEnabled);

  if (!currentScript) {
    return (
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-muted-foreground">No script to export.</p>
        <Button onClick={() => setStep("input")} className="mt-4">
          Start over
        </Button>
      </div>
    );
  }

  const formatSegmentText = (text: string) => {
    return includeAudioTags ? text : stripAudioTags(text);
  };

  const formatSegment = (text: string, visualPrompt?: string) => {
    const body = formatSegmentText(text);
    if (!includeVisualPrompts || !visualPrompt?.trim()) return body;
    return `${body}\n\n[visual:] ${visualPrompt.trim()} [/visual]`;
  };

  const fullScript = currentScript.segments
    .map((s) => formatSegment(s.text, s.visualPrompt))
    .join("\n\n");
  const markdown = `# ${currentScript.title}\n\n${currentScript.segments
    .map((s) => `## ${s.type.toUpperCase()}\n\n${formatSegment(s.text, s.visualPrompt)}`)
    .join("\n\n")}`;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(fullScript);
    setCopied(true);
    toast.success("Copied to clipboard");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (format: "txt" | "md") => {
    const blob = new Blob(
      [format === "md" ? markdown : fullScript],
      { type: "text/plain" }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${currentScript.title.replace(/\s+/g, "-").toLowerCase()}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(`Downloaded .${format} file`);
  };

  const handleStartOver = () => {
    resetDraft();
    toast.info("Draft reset");
  };

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight sm:text-2xl">Export your script</h2>
          <p className="text-sm text-muted-foreground sm:text-base">Copy it or download for later.</p>
        </div>
        <Button variant="outline" onClick={() => setStep("review")} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to editor
        </Button>
      </div>

      <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>Export</span>
        <span>Step 3 of 3</span>
      </div>
      <Progress value={100} className="mb-8" />

      <Card>
        <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <h3 className="truncate font-semibold">{currentScript.title}</h3>
            <p className="text-xs text-muted-foreground">
              {currentScript.segments.length} segments · {fullScript.split(/\s+/).filter(Boolean).length} words
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Label className="flex cursor-pointer items-center gap-2 text-xs font-normal">
              <Checkbox
                checked={includeAudioTags}
                onCheckedChange={(checked) => setIncludeAudioTags(Boolean(checked))}
              />
              Include audio tags
            </Label>
            <Label className="flex cursor-pointer items-center gap-2 text-xs font-normal">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                checked={includeVisualPrompts}
                onChange={(e) => setIncludeVisualPrompts(e.target.checked)}
              />
              Include visual prompts
            </Label>
            <div className="hidden h-4 w-px bg-border sm:block" />
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-4 w-4" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              Copy
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => handleDownload("txt")}
            >
              <Download className="h-4 w-4" />
              .txt
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2"
              onClick={() => handleDownload("md")}
            >
              <Download className="h-4 w-4" />
              .md
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <Textarea
            value={fullScript}
            readOnly
            rows={14}
            className="resize-none font-mono text-sm"
          />
        </CardContent>
      </Card>

      <div className="flex justify-center">
        <Button onClick={handleStartOver} variant="secondary" className="gap-2">
          <RotateCcw className="h-4 w-4" />
          Create another script
        </Button>
      </div>
    </div>
  );
}
