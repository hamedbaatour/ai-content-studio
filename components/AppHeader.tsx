"use client";

import { useAppStore } from "@/stores/app-store";
import { ProviderSettings } from "@/components/providers/ProviderSettings";
import { ThemeToggle } from "@/components/ThemeToggle";

export function AppHeader() {
  const currentScript = useAppStore((s) => s.currentScript);
  const step = useAppStore((s) => s.step);

  const showTitle = currentScript && step !== "input";

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="min-w-0 font-semibold tracking-tight">
          {showTitle ? (
            <span className="block truncate" title={currentScript.title}>
              {currentScript.title}
            </span>
          ) : (
            "AI Content Studio"
          )}
        </div>
        <div className="flex items-center gap-1">
          <ThemeToggle />
          <ProviderSettings />
        </div>
      </div>
    </header>
  );
}
