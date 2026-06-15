"use client";

import { useAppStore } from "@/stores/app-store";
import { ClientOnly } from "@/components/ClientOnly";
import { AppHeader } from "@/components/AppHeader";
import { InputStep } from "@/components/steps/InputStep";
import { ReviewStep } from "@/components/steps/ReviewStep";
import { ExportStep } from "@/components/steps/ExportStep";

function StepRenderer() {
  const step = useAppStore((s) => s.step);

  return (
    <>
      {step === "input" && <InputStep />}
      {step === "review" && <ReviewStep />}
      {step === "export" && <ExportStep />}
    </>
  );
}

export default function Home() {
  return (
    <>
      <AppHeader />
      <main className="flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <ClientOnly>
            <StepRenderer />
          </ClientOnly>
        </div>
      </main>
    </>
  );
}
