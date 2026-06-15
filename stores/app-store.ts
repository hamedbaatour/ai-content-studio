import { create } from "zustand";
import { persist } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type {
  AppState,
  Draft,
  ProviderSettings,
  Script,
  Step,
} from "@/lib/types";

const defaultDraft: Draft = {
  brainDump: "",
  contentType: "tiktok",
  tone: "casual",
  length: 30,
  style: "direct",
};

const defaultSettings: ProviderSettings = {
  provider: "gemini",
  model: "gemini-3.5-flash",
  groqApiKey: "",
  geminiApiKey: "",
  ollamaBaseUrl: "http://localhost:11434",
};

const initialState: Omit<AppState, "setStep" | "setDraft" | "setSettings" | "setCurrentScript" | "addVersion" | "setLoading" | "setError" | "setUiField" | "restoreVersion" | "updateSegmentText" | "resetDraft"> = {
  step: "input",
  draft: defaultDraft,
  settings: defaultSettings,
  currentScript: null,
  versions: [],
  isLoading: false,
  loadingMessage: "",
  error: null,
  ui: {
    activeSegmentId: null,
    showProviderSettings: false,
  },
};

interface Actions {
  setStep: (step: Step) => void;
  setDraft: (draft: Partial<Draft>) => void;
  setSettings: (settings: Partial<ProviderSettings>) => void;
  setCurrentScript: (script: Script | null) => void;
  addVersion: (script: Script) => void;
  restoreVersion: (scriptId: string) => void;
  setLoading: (isLoading: boolean, message?: string) => void;
  setError: (error: string | null) => void;
  setUiField: <K extends keyof AppState["ui"]>(
    key: K,
    value: AppState["ui"][K]
  ) => void;
  updateSegmentText: (segmentId: string, text: string) => void;
  updateSegmentVisualPrompt: (segmentId: string, visualPrompt: string) => void;
  resetDraft: () => void;
}

export const useAppStore = create<AppState & Actions>()(
  immer(
    persist(
      (set) => ({
        ...initialState,
        setStep: (step) =>
          set((state) => {
            state.step = step;
          }),
        setDraft: (draft) =>
          set((state) => {
            Object.assign(state.draft, draft);
          }),
        setSettings: (settings) =>
          set((state) => {
            Object.assign(state.settings, settings);
          }),
        setCurrentScript: (script) =>
          set((state) => {
            state.currentScript = script;
          }),
        addVersion: (script) =>
          set((state) => {
            state.versions.unshift(script);
            if (state.versions.length > 50) {
              state.versions.pop();
            }
          }),
        restoreVersion: (scriptId) =>
          set((state) => {
            const version = state.versions.find((v) => v.id === scriptId);
            if (version) {
              state.currentScript = version;
            }
          }),
        setLoading: (isLoading, message = "") =>
          set((state) => {
            state.isLoading = isLoading;
            state.loadingMessage = message;
            if (isLoading) state.error = null;
          }),
        setError: (error) =>
          set((state) => {
            state.error = error;
          }),
        setUiField: (key, value) =>
          set((state) => {
            state.ui[key] = value;
          }),
        updateSegmentText: (segmentId, text) =>
          set((state) => {
            if (state.currentScript) {
              const segment = state.currentScript.segments.find(
                (s) => s.id === segmentId
              );
              if (segment) segment.text = text;
            }
          }),
        updateSegmentVisualPrompt: (segmentId, visualPrompt) =>
          set((state) => {
            if (state.currentScript) {
              const segment = state.currentScript.segments.find(
                (s) => s.id === segmentId
              );
              if (segment) segment.visualPrompt = visualPrompt;
            }
          }),
        resetDraft: () =>
          set((state) => {
            state.draft = defaultDraft;
            state.currentScript = null;
            state.versions = [];
            state.step = "input";
            state.error = null;
          }),
      }),
      {
        name: "content-studio-store",
        version: 3,
        partialize: (state) => ({
          draft: state.draft,
          settings: state.settings,
        }),
        migrate: (persistedState: unknown, version: number) => {
          const state = persistedState as {
            draft?: { length?: number; featureDescription?: string; usefulness?: string; brainDump?: string };
            settings?: { provider?: string; model?: string };
          };

          if (version < 1) {
            if (state?.draft?.length && state.draft.length <= 5) {
              // Old abstract 1-5 scale -> map to seconds
              const mapping: Record<number, number> = {
                1: 15,
                2: 30,
                3: 45,
                4: 60,
                5: 90,
              };
              state.draft.length = mapping[state.draft.length] || 30;
            }
          }

          if (version < 2) {
            // Merge old structured fields into freeform brain dump
            const feature = state?.draft?.featureDescription || "";
            const usefulness = state?.draft?.usefulness || "";
            const existingBrainDump = state?.draft?.brainDump || "";
            const parts = [feature, usefulness, existingBrainDump].filter(Boolean);
            if (state?.draft) {
              state.draft.brainDump = parts.join("\n\n");
              delete (state.draft as { featureDescription?: string }).featureDescription;
              delete (state.draft as { usefulness?: string }).usefulness;
            }
          }

          if (version < 3) {
            // Replace deprecated Groq models
            const groqModelMapping: Record<string, string> = {
              "llama3-8b-8192": "llama-3.1-8b-instant",
              "llama3-70b-8192": "llama-3.3-70b-versatile",
              "gemma2-9b-it": "llama-3.1-8b-instant",
            };
            if (state?.settings?.provider === "groq" && state.settings.model && groqModelMapping[state.settings.model]) {
              state.settings.model = groqModelMapping[state.settings.model];
            }
          }

          return state;
        },
      }
    )
  )
);
