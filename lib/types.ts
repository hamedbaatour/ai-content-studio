export type AIProvider = "ollama" | "groq" | "gemini";

export type SegmentType =
  | "hook"
  | "problem"
  | "solution"
  | "benefit"
  | "proof"
  | "objection"
  | "cta";

export interface ScriptSegment {
  id: string;
  type: SegmentType;
  text: string;
  visualPrompt: string;
}

export interface Script {
  id: string;
  title: string;
  segments: ScriptSegment[];
  createdAt: number;
  provider: AIProvider;
  model: string;
}

export type ContentType =
  | "tiktok"
  | "instagram-reels"
  | "youtube-shorts"
  | "twitter-thread"
  | "linkedin-post";

export type Tone = "casual" | "professional" | "hype" | "inspirational" | "witty";
export type Style = "story" | "listicle" | "direct" | "educational" | "dramatic";

export interface Draft {
  brainDump: string;
  contentType: ContentType;
  tone: Tone;
  length: number; // target duration in seconds (e.g. 15, 30, 45, 60, 90)
  style: Style;
}

export interface ProviderSettings {
  provider: AIProvider;
  model: string;
  groqApiKey: string;
  geminiApiKey: string;
  ollamaBaseUrl: string;
}

export interface FeedbackLog {
  id: string;
  timestamp: number;
  scriptId: string;
  sessionId: string;
  provider: AIProvider;
  model: string;
  segmentType?: SegmentType;
  segmentId?: string;
  actionType: FeedbackActionType;
  instruction?: string;
  before?: string;
  after?: string;
  selectedText?: string;
  customPrompt?: string;
  metadata?: Record<string, unknown>;
}

export type FeedbackActionType =
  | "generation"
  | "refinement:shorter"
  | "refinement:longer"
  | "refinement:less_cheesy"
  | "refinement:more_human"
  | "refinement:more_hypey"
  | "refinement:dont_like"
  | "refinement:custom"
  | "selection:suggestions"
  | "selection:apply"
  | "selection:custom"
  | "global:tone"
  | "global:length"
  | "global:style"
  | "manual:edit"
  | "thought:integrate";

export type Step = "input" | "review" | "export";

export interface AggregatedPreferences {
  frequentLabels: { label: string; count: number }[];
  preferredTone?: Tone;
  preferredLength?: number;
  preferredStyle?: Style;
  commonCustomKeywords: { keyword: string; count: number }[];
  lastUpdated: number;
}

export interface AppState {
  step: Step;
  draft: Draft;
  settings: ProviderSettings;
  currentScript: Script | null;
  versions: Script[];
  isLoading: boolean;
  loadingMessage: string;
  error: string | null;
  audioTagsEnabled: boolean;
  ui: {
    activeSegmentId: string | null;
    showProviderSettings: boolean;
  };
}
