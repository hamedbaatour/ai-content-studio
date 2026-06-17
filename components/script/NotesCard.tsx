"use client";

import { useState } from "react";
import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { StickyNote, Plus, X, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
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

export function NotesCard() {
  const currentScript = useAppStore((s) => s.currentScript);
  const notes = useAppStore((s) => s.notes);
  const addNote = useAppStore((s) => s.addNote);
  const deleteNote = useAppStore((s) => s.deleteNote);
  const [isOpen, setIsOpen] = useState(false);
  const [text, setText] = useState("");
  const [segmentId, setSegmentId] = useState<string | undefined>(undefined);

  if (!currentScript) return null;

  const handleAdd = () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    addNote({ text: trimmed, segmentId });
    setText("");
    setSegmentId(undefined);
    setIsOpen(false);
  };

  const handleCancel = () => {
    setText("");
    setSegmentId(undefined);
    setIsOpen(false);
  };

  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 font-semibold">
          <StickyNote className="h-4 w-4" />
          Notes
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => setIsOpen((v) => !v)}
          aria-label={isOpen ? "Close notes" : "Add note"}
        >
          {isOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        </Button>
      </div>

      {isOpen && (
        <div className="mb-3 space-y-2">
          <Textarea
            placeholder="e.g. Make the hook more relatable..."
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={2}
            className="min-h-[72px] resize-y text-sm"
          />
          <div className="flex flex-wrap gap-1.5">
            <span className="text-xs text-muted-foreground">Reference:</span>
            <button
              type="button"
              onClick={() => setSegmentId(undefined)}
              className={cn(
                "rounded-md px-2 py-0.5 text-xs transition-colors",
                segmentId === undefined
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted hover:bg-muted/80"
              )}
            >
              General
            </button>
            {currentScript.segments.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setSegmentId(s.id)}
                className={cn(
                  "rounded-md px-2 py-0.5 text-xs transition-colors",
                  segmentId === s.id
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted hover:bg-muted/80"
                )}
              >
                {SEGMENT_LABELS[s.type]}
              </button>
            ))}
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              Cancel
            </Button>
            <Button size="sm" onClick={handleAdd} disabled={!text.trim()}>
              Add note
            </Button>
          </div>
        </div>
      )}

      {notes.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Jot down references, ideas, or feedback for any section.
        </p>
      ) : (
        <ScrollArea className="h-[180px] pr-2">
          <div className="space-y-2">
            {notes.map((note) => {
              const linkedSegment = note.segmentId
                ? currentScript.segments.find((s) => s.id === note.segmentId)
                : undefined;
              return (
                <div
                  key={note.id}
                  className="group relative rounded-lg border bg-muted/30 p-2.5 pr-8"
                >
                  <p className="whitespace-pre-wrap text-sm leading-relaxed">{note.text}</p>
                  <div className="mt-1.5 flex items-center gap-1.5">
                    {linkedSegment ? (
                      <Badge variant="secondary" className="text-[10px]">
                        {SEGMENT_LABELS[linkedSegment.type]}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[10px]">
                        General
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(note.createdAt).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1 h-6 w-6 opacity-0 transition-opacity group-hover:opacity-100"
                    onClick={() => deleteNote(note.id)}
                    aria-label="Delete note"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
