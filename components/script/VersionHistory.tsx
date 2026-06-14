"use client";

import { useState } from "react";
import { useAppStore } from "@/stores/app-store";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Clock, RotateCcw } from "lucide-react";
import type { ScriptSegment } from "@/lib/types";

const SEGMENT_LABELS: Record<ScriptSegment["type"], string> = {
  hook: "Hook",
  problem: "Problem",
  solution: "Solution",
  benefit: "Benefit",
  proof: "Proof",
  objection: "Objection",
  cta: "Call to Action",
};

export function VersionHistory() {
  const versions = useAppStore((s) => s.versions);
  const currentScript = useAppStore((s) => s.currentScript);
  const restoreVersion = useAppStore((s) => s.restoreVersion);
  const [selectedVersion, setSelectedVersion] = useState<(typeof versions)[number] | null>(null);

  if (versions.length === 0) {
    return (
      <div className="rounded-xl border bg-card p-4 text-sm text-muted-foreground">
        No versions yet. Start generating to build your history.
      </div>
    );
  }

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2 font-semibold">
        <Clock className="h-4 w-4" />
        Version history
      </div>
      <ScrollArea className="h-[220px] pr-2 sm:h-[280px]">
        <div className="space-y-2">
          {versions.map((v, idx) => {
            const isActive = currentScript?.id === v.id;
            return (
              <div
                key={v.id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedVersion(v)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    setSelectedVersion(v);
                  }
                }}
                className={`cursor-pointer rounded-lg border p-3 transition-colors ${
                  isActive
                    ? "border-primary bg-primary/5"
                    : "hover:bg-muted/50"
                }`}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-medium text-muted-foreground">
                    #{versions.length - idx}
                  </span>
                  {!isActive && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={(e) => {
                        e.stopPropagation();
                        restoreVersion(v.id);
                      }}
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
                <p className="line-clamp-2 text-sm font-medium">{v.title}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {new Date(v.createdAt).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {" · "}
                  {v.provider}
                </p>
              </div>
            );
          })}
        </div>
      </ScrollArea>

      <Dialog open={!!selectedVersion} onOpenChange={(open) => !open && setSelectedVersion(null)}>
        <DialogContent className="max-h-[85vh] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedVersion?.title}</DialogTitle>
            <DialogDescription>
              {selectedVersion && (
                <>
                  {new Date(selectedVersion.createdAt).toLocaleString([], {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                  {" · "}
                  {selectedVersion.provider}
                  {" · "}
                  {selectedVersion.model}
                </>
              )}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-2">
            <div className="space-y-4 py-2">
              {selectedVersion?.segments.map((segment) => (
                <div key={segment.id} className="rounded-lg border bg-muted/30 p-3">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {SEGMENT_LABELS[segment.type]}
                  </p>
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{segment.text}</p>
                </div>
              ))}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
