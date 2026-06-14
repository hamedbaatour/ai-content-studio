import { get, set, createStore } from "idb-keyval";
import type { FeedbackLog, AggregatedPreferences, FeedbackActionType } from "@/lib/types";

const feedbackStore = createStore("content-studio-feedback", "feedback-store");

const LOGS_KEY = "feedback_logs";
const PREFS_KEY = "preferences_aggregated";
const MAX_LOGS = 500;

export async function getFeedbackLogs(): Promise<FeedbackLog[]> {
  if (typeof window === "undefined") return [];
  return (await get(LOGS_KEY, feedbackStore)) || [];
}

export async function addFeedbackLog(log: Omit<FeedbackLog, "id" | "timestamp">): Promise<FeedbackLog> {
  if (typeof window === "undefined") {
    throw new Error("Feedback DB only available in the browser");
  }
  const logs = await getFeedbackLogs();
  const entry: FeedbackLog = {
    ...log,
    id: generateId(),
    timestamp: Date.now(),
  };
  logs.unshift(entry);
  if (logs.length > MAX_LOGS) {
    logs.length = MAX_LOGS;
  }
  await set(LOGS_KEY, logs, feedbackStore);
  await recomputePreferences();
  return entry;
}

export async function getAggregatedPreferences(): Promise<AggregatedPreferences | null> {
  if (typeof window === "undefined") return null;
  return (await get(PREFS_KEY, feedbackStore)) || null;
}

export async function exportFeedbackToJSON(): Promise<string> {
  const logs = await getFeedbackLogs();
  const prefs = await getAggregatedPreferences();
  return JSON.stringify({ logs, preferences: prefs, exportedAt: Date.now() }, null, 2);
}

export async function clearFeedbackLogs(): Promise<void> {
  await set(LOGS_KEY, [], feedbackStore);
  await set(PREFS_KEY, null, feedbackStore);
}

async function recomputePreferences(): Promise<AggregatedPreferences> {
  const logs = await getFeedbackLogs();
  const recentLogs = logs.slice(0, 200);

  // Count quick feedback labels
  const labelCounts = new Map<string, number>();
  const keywordCounts = new Map<string, number>();
  const toneCounts = new Map<string, number>();
  const styleCounts = new Map<string, number>();
  const lengthValues: number[] = [];

  for (const log of recentLogs) {
    const label = labelFromActionType(log.actionType);
    if (label) {
      labelCounts.set(label, (labelCounts.get(label) || 0) + 1);
    }

    if (log.customPrompt) {
      const words = log.customPrompt
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, "")
        .split(/\s+/)
        .filter((w) => w.length > 3 && !STOP_WORDS.has(w));
      for (const word of words) {
        keywordCounts.set(word, (keywordCounts.get(word) || 0) + 1);
      }
    }

    if (log.metadata && typeof log.metadata === "object") {
      const meta = log.metadata as Record<string, unknown>;
      if (meta.tone) toneCounts.set(String(meta.tone), (toneCounts.get(String(meta.tone)) || 0) + 1);
      if (meta.style) styleCounts.set(String(meta.style), (styleCounts.get(String(meta.style)) || 0) + 1);
      if (typeof meta.length === "number") lengthValues.push(meta.length);
    }
  }

  const frequentLabels = Array.from(labelCounts.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const commonCustomKeywords = Array.from(keywordCounts.entries())
    .map(([keyword, count]) => ({ keyword, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  const preferredTone = toneCounts.size > 0
    ? (Array.from(toneCounts.entries()).sort((a, b) => b[1] - a[1])[0][0] as AggregatedPreferences["preferredTone"])
    : undefined;

  const preferredStyle = styleCounts.size > 0
    ? (Array.from(styleCounts.entries()).sort((a, b) => b[1] - a[1])[0][0] as AggregatedPreferences["preferredStyle"])
    : undefined;

  const preferredLength = lengthValues.length > 0
    ? Math.round(lengthValues.reduce((a, b) => a + b, 0) / lengthValues.length)
    : undefined;

  const prefs: AggregatedPreferences = {
    frequentLabels,
    preferredTone,
    preferredStyle,
    preferredLength,
    commonCustomKeywords,
    lastUpdated: Date.now(),
  };

  await set(PREFS_KEY, prefs, feedbackStore);
  return prefs;
}

function labelFromActionType(actionType: FeedbackActionType): string | null {
  switch (actionType) {
    case "refinement:shorter":
      return "shorter";
    case "refinement:longer":
      return "longer";
    case "refinement:less_cheesy":
      return "less cheesy";
    case "refinement:more_human":
      return "more human";
    case "refinement:more_hypey":
      return "more hypey";
    case "refinement:dont_like":
      return "rewrite";
    case "refinement:custom":
      return "custom refinement";
    case "selection:suggestions":
      return "text selection improvement";
    case "selection:apply":
      return "applied suggestion";
    case "selection:custom":
      return "custom selection prompt";
    case "global:tone":
      return "tone adjustment";
    case "global:length":
      return "length adjustment";
    case "global:style":
      return "style adjustment";
    case "thought:integrate":
      return "thought integration";
    default:
      return null;
  }
}

function generateId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

const STOP_WORDS = new Set([
  "make",
  "this",
  "that",
  "with",
  "from",
  "they",
  "them",
  "their",
  "have",
  "will",
  "would",
  "should",
  "could",
  "about",
  "because",
  "before",
  "after",
  "during",
  "without",
  "within",
  "under",
  "over",
  "between",
  "through",
  "against",
  "among",
  "towards",
  "something",
  "someone",
  "everything",
  "everyone",
  "anything",
  "anyone",
  "nothing",
  "nobody",
]);
