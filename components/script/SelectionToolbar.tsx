"use client";

import { Button } from "@/components/ui/button";
import { Wand2, Zap, MessageSquare } from "lucide-react";

interface SelectionToolbarProps {
  rect: DOMRect;
  onImprove: () => void;
  onPunchier: () => void;
  onSimpler: () => void;
  onCustom: () => void;
}

export function SelectionToolbar({
  rect,
  onImprove,
  onPunchier,
  onSimpler,
  onCustom,
}: SelectionToolbarProps) {
  // Position above the selection, centered horizontally
  const desiredTop = rect.top + window.scrollY - 48;
  const desiredLeft = rect.left + window.scrollX + rect.width / 2;

  // Clamp so it stays on-screen on mobile
  const toolbarWidth = 240; // approximate max width
  const minLeft = toolbarWidth / 2 + 8;
  const maxLeft = window.innerWidth - toolbarWidth / 2 - 8;
  const top = Math.max(8, desiredTop);
  const left = Math.max(minLeft, Math.min(desiredLeft, maxLeft));

  return (
    <div
      className="fixed z-50 flex max-w-[calc(100vw-2rem)] flex-wrap items-center justify-center gap-1 rounded-lg border bg-popover p-1.5 shadow-lg animate-in fade-in zoom-in-95"
      style={{ top, left }}
    >
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 px-2.5 text-xs"
        onClick={onImprove}
      >
        <Wand2 className="h-3.5 w-3.5" />
        Improve
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 px-2.5 text-xs"
        onClick={onPunchier}
      >
        <Zap className="h-3.5 w-3.5" />
        Punchier
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 px-2.5 text-xs"
        onClick={onSimpler}
      >
        Simpler
      </Button>
      <Button
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 px-2.5 text-xs"
        onClick={onCustom}
      >
        <MessageSquare className="h-3.5 w-3.5" />
        Custom
      </Button>
    </div>
  );
}
