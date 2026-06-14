import { getAggregatedPreferences as getPrefsFromDb } from "./db/feedback-db";
import type { AggregatedPreferences } from "./types";

export async function getAggregatedPreferences(): Promise<AggregatedPreferences | null> {
  return getPrefsFromDb();
}

export function formatPreferenceSummary(prefs: AggregatedPreferences | null): string {
  if (!prefs) return "No personalization data yet.";
  const parts: string[] = [];
  if (prefs.preferredTone) parts.push(`Tone: ${prefs.preferredTone}`);
  if (prefs.preferredStyle) parts.push(`Style: ${prefs.preferredStyle}`);
  if (typeof prefs.preferredLength === "number") parts.push(`Length: ${prefs.preferredLength}/5`);
  if (prefs.frequentLabels.length > 0) {
    parts.push(`Top feedback: ${prefs.frequentLabels.slice(0, 3).map((l) => l.label).join(", ")}`);
  }
  return parts.join(" · ") || "No personalization data yet.";
}
