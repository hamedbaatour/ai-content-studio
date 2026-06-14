"use client";

import { useAppStore } from "@/stores/app-store";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getProviderModels, getDefaultModel } from "@/lib/ai/providers";
import type { AIProvider } from "@/lib/types";
import { Settings2 } from "lucide-react";

const PROVIDER_OPTIONS: { value: AIProvider; label: string; description: string }[] = [
  {
    value: "gemini",
    label: "Google Gemini",
    description: "Use a Google AI Studio API key. Fast and high quality.",
  },
  {
    value: "groq",
    label: "Groq",
    description: "Blazing fast inference with Llama, Mixtral, and Gemma models.",
  },
  {
    value: "ollama",
    label: "Ollama (local)",
    description: "Run models locally. Requires Ollama running with CORS enabled.",
  },
];

export function ProviderSettings() {
  const settings = useAppStore((s) => s.settings);
  const setSettings = useAppStore((s) => s.setSettings);

  const models = getProviderModels(settings.provider);

  const handleProviderChange = (provider: AIProvider) => {
    setSettings({
      provider,
      model: getDefaultModel(provider),
    });
  };

  return (
    <Dialog>
      <DialogTrigger
        render={
          <Button variant="outline" size="sm" className="gap-2">
            <Settings2 className="h-4 w-4" />
            AI Provider
          </Button>
        }
      />
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>AI Provider Settings</DialogTitle>
          <DialogDescription>
            Choose how you want to power the content generation. Keys are stored
            locally in your browser.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5 py-4">
          <div className="grid gap-2">
            <Label htmlFor="provider">Provider</Label>
            <Select
              value={settings.provider}
              onValueChange={(v) => handleProviderChange(v as AIProvider)}
            >
              <SelectTrigger id="provider">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent>
                {PROVIDER_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex flex-col items-start">
                      <span>{opt.label}</span>
                      <span className="text-xs text-muted-foreground">
                        {opt.description}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="model">Model</Label>
            <Select
              value={settings.model}
              onValueChange={(v) => setSettings({ model: v || "" })}
            >
              <SelectTrigger id="model">
                <SelectValue placeholder="Select model" />
              </SelectTrigger>
              <SelectContent>
                {models.map((m) => (
                  <SelectItem key={m.value} value={m.value}>
                    {m.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {settings.provider === "gemini" && (
            <div className="grid gap-2">
              <Label htmlFor="gemini-key">Gemini API Key</Label>
              <Input
                id="gemini-key"
                type="password"
                placeholder="AIza..."
                value={settings.geminiApiKey}
                onChange={(e) => setSettings({ geminiApiKey: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Get your key from{" "}
                <a
                  href="https://aistudio.google.com/app/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  Google AI Studio
                </a>
                .
              </p>
            </div>
          )}

          {settings.provider === "groq" && (
            <div className="grid gap-2">
              <Label htmlFor="groq-key">Groq API Key</Label>
              <Input
                id="groq-key"
                type="password"
                placeholder="gsk_..."
                value={settings.groqApiKey}
                onChange={(e) => setSettings({ groqApiKey: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Get your key from{" "}
                <a
                  href="https://console.groq.com/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="underline"
                >
                  Groq Console
                </a>
                .
              </p>
            </div>
          )}

          {settings.provider === "ollama" && (
            <div className="grid gap-2">
              <Label htmlFor="ollama-url">Ollama Base URL</Label>
              <Input
                id="ollama-url"
                placeholder="http://localhost:11434"
                value={settings.ollamaBaseUrl}
                onChange={(e) => setSettings({ ollamaBaseUrl: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Run{" "}
                <code className="rounded bg-muted px-1 py-0.5">
                  OLLAMA_ORIGINS=* ollama serve
                </code>{" "}
                to avoid CORS issues.
              </p>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
