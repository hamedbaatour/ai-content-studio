"use client";

import { ProviderSettings } from "@/components/providers/ProviderSettings";

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="font-semibold tracking-tight">AI Content Studio</div>
        <ProviderSettings />
      </div>
    </header>
  );
}
