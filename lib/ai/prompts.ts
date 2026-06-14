import type {
  Draft,
  ScriptSegment,
  SegmentType,
  AggregatedPreferences,
  FeedbackActionType,
} from "@/lib/types";

const SEGMENT_LABELS: Record<SegmentType, string> = {
  hook: "Hook",
  problem: "Problem / Pain Point",
  solution: "Solution / Feature",
  benefit: "Key Benefit",
  proof: "Proof / Social Proof",
  objection: "Objection Handler",
  cta: "Call to Action",
};

const CONTENT_TYPE_LABELS: Record<string, string> = {
  tiktok: "TikTok video script",
  "instagram-reels": "Instagram Reels script",
  "youtube-shorts": "YouTube Shorts script",
  "twitter-thread": "Twitter/X thread",
  "linkedin-post": "LinkedIn post",
};

const TONE_LABELS: Record<string, string> = {
  casual: "casual and conversational",
  professional: "professional and authoritative",
  hype: "hype and energetic",
  inspirational: "inspirational and uplifting",
  witty: "witty and clever",
};

const STYLE_LABELS: Record<string, string> = {
  story: "story-driven narrative",
  listicle: "listicle / bullet-style",
  direct: "direct and to-the-point",
  educational: "educational and explanatory",
  dramatic: "dramatic and curiosity-driven",
};

function getLengthGuide(lengthSeconds: number): string {
  // Estimate ~2.5 words per second for spoken short-form content
  const wordCount = Math.round(lengthSeconds * 2.5);
  return `about ${lengthSeconds} seconds long (roughly ${wordCount} spoken words)`;
}

function buildPersonalizationNote(prefs: AggregatedPreferences | null): string {
  if (!prefs) return "";
  const parts: string[] = [];

  if (prefs.preferredTone) {
    parts.push(`The user tends to prefer a ${prefs.preferredTone} tone.`);
  }
  if (prefs.preferredStyle) {
    parts.push(`The user tends to prefer a ${prefs.preferredStyle} style.`);
  }
  if (typeof prefs.preferredLength === "number") {
    parts.push(`The user tends to prefer ${getLengthGuide(prefs.preferredLength)} content.`);
  }
  if (prefs.frequentLabels.length > 0) {
    const top = prefs.frequentLabels
      .slice(0, 5)
      .map((l) => `"${l.label}" (${l.count}x)`)
      .join(", ");
    parts.push(`Recent feedback themes: ${top}.`);
  }
  if (prefs.commonCustomKeywords.length > 0) {
    const keywords = prefs.commonCustomKeywords
      .slice(0, 5)
      .map((k) => `"${k.keyword}"`)
      .join(", ");
    parts.push(`Common custom prompt themes: ${keywords}.`);
  }

  if (parts.length === 0) return "";
  return `\n\n[PERSONALIZATION CONTEXT - USE AS GUIDANCE]\n${parts.join(" ")}`;
}

function buildOutputFormatInstructions(): string {
  return `
You must respond with a single JSON object and no markdown formatting. Use this exact structure:
{
  "title": "A short, catchy title for this piece of content",
  "segments": [
    { "type": "hook", "text": "..." },
    { "type": "problem", "text": "..." },
    { "type": "solution", "text": "..." },
    { "type": "benefit", "text": "..." },
    { "type": "cta", "text": "..." }
  ]
}

Segment types you can use: hook, problem, solution, benefit, proof, objection, cta. Choose the ones that best fit the content. Include at least hook, solution, and cta.
`;
}

export interface GenerationPromptInput {
  draft: Draft;
  preferences: AggregatedPreferences | null;
}

export function buildGenerationPrompt(input: GenerationPromptInput) {
  const { draft, preferences } = input;

  const system = `You are an elite short-form content marketer. You write scroll-stopping scripts for social media.
The user will give you a raw brain dump of ideas. Your job is to read it, extract the strongest angle, and turn it into a compelling, structured script.

Rules:
- Figure out the best segments yourself (hook, problem, solution, benefit, proof, objection, cta). Pick only the segments that serve the idea.
- Lead with a strong hook in the first segment.
- Speak directly to the reader ("you").
- Avoid generic buzzwords. Be specific and concrete.
- Match the requested tone, length, and style.
- Make every segment earn its place.
- Do not use emojis unless they genuinely add clarity.
- Keep sentences punchy and easy to read aloud.
${buildPersonalizationNote(preferences)}`;

  const user = `Create a ${CONTENT_TYPE_LABELS[draft.contentType] || "short-form script"}.

Here is the user's raw brain dump. Read it, extract the best parts, and structure the script yourself:
"""
${draft.brainDump}
"""

Tone: ${TONE_LABELS[draft.tone]}
Style: ${STYLE_LABELS[draft.style]}
Target length: ${getLengthGuide(draft.length)}

${buildOutputFormatInstructions()}

Make it feel like it was written by a human marketer who deeply understands the audience, not by a generic AI.`;

  return { system, user };
}

export interface RefinementPromptInput {
  segment: ScriptSegment;
  allSegments: ScriptSegment[];
  instruction: string;
  actionType: FeedbackActionType;
  draft: Draft;
  preferences: AggregatedPreferences | null;
}

export function buildRefinementPrompt(input: RefinementPromptInput) {
  const { segment, allSegments, instruction, draft, preferences } = input;

  const system = `You are an elite short-form content editor. You rewrite a single segment of a social media script based on precise feedback.

Rules:
- Only rewrite the provided segment. Do not rewrite the other segments.
- Preserve the original meaning and context unless the user explicitly asks to change it.
- Match the overall tone and style of the script.
- Return only the new text for the segment, with no labels, JSON, or extra commentary.
${buildPersonalizationNote(preferences)}`;

  const fullScriptContext = allSegments
    .map((s) => `[${SEGMENT_LABELS[s.type]}]: ${s.text}`)
    .join("\n\n");

  const user = `Here is the full script for context:

${fullScriptContext}

---

Rewrite ONLY this segment:
[${SEGMENT_LABELS[segment.type]}]: ${segment.text}

Feedback instruction: ${instruction}

Tone: ${TONE_LABELS[draft.tone]}
Style: ${STYLE_LABELS[draft.style]}
Target length: ${getLengthGuide(draft.length)}

Return only the rewritten segment text. Do not wrap it in quotes or add any explanation.`;

  return { system, user };
}

export interface ThoughtIntegrationPromptInput {
  segment: ScriptSegment;
  allSegments: ScriptSegment[];
  thought: string;
  draft: Draft;
  preferences: AggregatedPreferences | null;
}

export function buildThoughtIntegrationPrompt(input: ThoughtIntegrationPromptInput) {
  const { segment, allSegments, thought, draft, preferences } = input;

  const system = `You are an elite short-form content editor. A user has a thought they want you to gracefully integrate into a specific segment of a social media script.

Rules:
- Weave the thought into the segment naturally. Do not bolt it on awkwardly.
- Preserve the segment's original role and meaning unless the thought explicitly changes it.
- Keep the surrounding script flow and context in mind.
- Match the requested tone, style, and target length.
- Return ONLY the rewritten segment text. No labels, JSON, or extra commentary.
${buildPersonalizationNote(preferences)}`;

  const fullScriptContext = allSegments
    .map((s) => `[${SEGMENT_LABELS[s.type]}]: ${s.text}`)
    .join("\n\n");

  const user = `Here is the full script for context:

${fullScriptContext}

---

Rewrite this segment by gracefully integrating the user's thought:
[${SEGMENT_LABELS[segment.type]}]: ${segment.text}

User's thought to integrate:
"""
${thought}
"""

Tone: ${TONE_LABELS[draft.tone]}
Style: ${STYLE_LABELS[draft.style]}
Target length: ${getLengthGuide(draft.length)}

Return only the rewritten segment text. Do not wrap it in quotes or add any explanation.`;

  return { system, user };
}

export interface SuggestionsPromptInput {
  segment: ScriptSegment;
  allSegments: ScriptSegment[];
  selectedText: string;
  draft: Draft;
  preferences: AggregatedPreferences | null;
}

export function buildSuggestionsPrompt(input: SuggestionsPromptInput) {
  const { segment, allSegments, selectedText, draft, preferences } = input;

  const system = `You are an elite short-form content marketer. A user has highlighted a piece of text and wants alternative ways to say it better.

Rules:
- Provide exactly 3 suggestions.
- Each suggestion should be a marketer-quality rewrite of the highlighted text.
- Keep suggestions varied: one punchier, one more human, one sharper angle.
- Suggestions must fit naturally into the original sentence/segment.
- Respond with a JSON object only.
${buildPersonalizationNote(preferences)}`;

  const fullScriptContext = allSegments
    .map((s) => `[${SEGMENT_LABELS[s.type]}]: ${s.text}`)
    .join("\n\n");

  const user = `Full script context:

${fullScriptContext}

---

Segment: [${SEGMENT_LABELS[segment.type]}]: ${segment.text}

Highlighted text: "${selectedText}"

Tone: ${TONE_LABELS[draft.tone]}
Style: ${STYLE_LABELS[draft.style]}

Respond with this JSON structure only:
{
  "suggestions": [
    { "label": "Punchier", "text": "..." },
    { "label": "More human", "text": "..." },
    { "label": "Sharper angle", "text": "..." }
  ]
}`;

  return { system, user };
}

export function instructionFromActionType(actionType: FeedbackActionType): string {
  switch (actionType) {
    case "refinement:shorter":
      return "Make this segment shorter and more concise while keeping the impact.";
    case "refinement:longer":
      return "Expand this segment with more detail and substance, but keep it engaging.";
    case "refinement:less_cheesy":
      return "Make this segment feel less cheesy, less corporate, and more authentic.";
    case "refinement:more_human":
      return "Make this segment sound more human, natural, and conversational, like a real person talking.";
    case "refinement:more_hypey":
      return "Make this segment more hypey, energetic, and exciting without being cringe.";
    case "refinement:dont_like":
      return "Rewrite this segment completely. The current version is not working. Try a fresh, stronger angle.";
    default:
      return "Improve this segment.";
  }
}

export function parseScriptJson(raw: string): { title: string; segments: { type: SegmentType; text: string }[] } | null {
  try {
    // Try to extract JSON if wrapped in markdown
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : raw;
    const parsed = JSON.parse(jsonStr);
    if (parsed && Array.isArray(parsed.segments)) {
      return {
        title: parsed.title || "Untitled Script",
        segments: parsed.segments
          .filter((s: { type?: string; text?: string }) => s.type && s.text)
          .map((s: { type: string; text: string }) => ({
            type: s.type as SegmentType,
            text: s.text.trim(),
          })),
      };
    }
  } catch {
    // ignore
  }
  return null;
}

export function parseSuggestionsJson(raw: string): { label: string; text: string }[] | null {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : raw;
    const parsed = JSON.parse(jsonStr);
    if (parsed && Array.isArray(parsed.suggestions)) {
      return parsed.suggestions
        .filter((s: { text?: string }) => s.text)
        .map((s: { label?: string; text: string }) => ({
          label: s.label || "Suggestion",
          text: s.text.trim(),
        }));
    }
  } catch {
    // ignore
  }
  return null;
}

export interface SegmentVariationsPromptInput {
  segment: ScriptSegment;
  allSegments: ScriptSegment[];
  draft: Draft;
  preferences: AggregatedPreferences | null;
}

/**
 * Default prompt used to generate segment variations.
 * Edit this function in lib/ai/prompts.ts if you want to change the AI instructions.
 */
export function buildSegmentVariationsPrompt(input: SegmentVariationsPromptInput) {
  const { segment, allSegments, draft, preferences } = input;

  const system = `You are an elite short-form content marketer.
Your task is to generate 3 strong variations of a single segment from a social media script.

Rules:
- Each variation must fit the segment's role (${SEGMENT_LABELS[segment.type]}).
- Variations should feel different from each other (e.g. angle, energy, opening word, emotional hook).
- Keep them roughly the same length as the original.
- Match the requested tone and style.
- Do not use emojis unless they genuinely add clarity.
${buildPersonalizationNote(preferences)}`;

  const fullScriptContext = allSegments
    .map((s) => `[${SEGMENT_LABELS[s.type]}]: ${s.text}`)
    .join("\n\n");

  const user = `Full script for context:

${fullScriptContext}

---

Segment to vary: [${SEGMENT_LABELS[segment.type]}]: ${segment.text}

Tone: ${TONE_LABELS[draft.tone]}
Style: ${STYLE_LABELS[draft.style]}
Target length: ${getLengthGuide(draft.length)}

Generate 3 alternative versions of this segment. Return ONLY a JSON object with this structure:
{
  "variations": [
    { "label": "Angle 1", "text": "..." },
    { "label": "Angle 2", "text": "..." },
    { "label": "Angle 3", "text": "..." }
  ]
}`;

  return { system, user };
}

export function parseVariationsJson(raw: string): { label: string; text: string }[] | null {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : raw;
    const parsed = JSON.parse(jsonStr);
    if (parsed && Array.isArray(parsed.variations)) {
      return parsed.variations
        .filter((v: { text?: string }) => v.text)
        .map((v: { label?: string; text: string }) => ({
          label: v.label || "Variation",
          text: v.text.trim(),
        }));
    }
  } catch {
    // ignore
  }
  return null;
}
