import type {
  Draft,
  Script,
  ScriptSegment,
  SegmentType,
  AggregatedPreferences,
  FeedbackActionType,
} from "@/lib/types";

export const AUDIO_TAGS = {
  emotional: ["EXCITED", "NERVOUS", "FRUSTRATED", "TIRED"],
  reactions: ["GASP", "SIGH", "LAUGHS", "GULPS"],
  volume: ["WHISPERING", "SHOUTING", "QUIETLY", "LOUDLY"],
  pacing: ["PAUSES", "STAMMERS", "RUSHED"],
} as const;

export const ALL_AUDIO_TAGS: string[] = [
  ...AUDIO_TAGS.emotional,
  ...AUDIO_TAGS.reactions,
  ...AUDIO_TAGS.volume,
  ...AUDIO_TAGS.pacing,
];

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
    { "type": "hook", "text": "...", "visualPrompt": "..." },
    { "type": "problem", "text": "...", "visualPrompt": "..." },
    { "type": "solution", "text": "...", "visualPrompt": "..." },
    { "type": "benefit", "text": "...", "visualPrompt": "..." },
    { "type": "cta", "text": "...", "visualPrompt": "..." }
  ]
}

Segment types you can use: hook, problem, solution, benefit, proof, objection, cta. Choose the ones that best fit the content. Include at least hook, solution, and cta.

Each segment must include a "visualPrompt" field: a short 1-2 sentence description of what appears on screen while the narrator reads this segment. Keep it specific, easy to shoot or source, and avoid describing dialogue.
`;
}

export interface GenerationPromptInput {
  draft: Draft;
  preferences: AggregatedPreferences | null;
  audioTagsEnabled?: boolean;
}

function buildAudioTagInstructions(): string {
  return `
AUDIO TAG DIRECTION (IMPORTANT):
This script will be read as a voiceover for a short-form video. Insert voice direction tags from this exact list where they improve delivery:
${ALL_AUDIO_TAGS.map((tag) => `- [${tag}]`).join("\n")}

Guidelines for placing tags:
- Layer tags inline before the words they affect, e.g. "[EXCITED] This is the part you’ve been waiting for!"
- Use [PAUSES] before a punchline or key reveal.
- Use [EXCITED] or [LOUDLY] at hooks and high-energy moments.
- Use [WHISPERING] or [QUIETLY] for intimacy or secrets.
- Use [NERVOUS], [STAMMERS], or [GULPS] when expressing doubt or vulnerability.
- Use [GASP], [SIGH], or [LAUGHS] as natural reactions.
- Use [RUSHED] for urgency.
- Do not invent tags that are not in the list above.
- Keep the text meaningful and readable; tags should enhance delivery, not clutter the script.`;
}

export function buildGenerationPrompt(input: GenerationPromptInput) {
  const { draft, preferences, audioTagsEnabled } = input;

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
${audioTagsEnabled ? buildAudioTagInstructions() : ""}
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

function buildAudioTagPreservationNote(audioTagsEnabled?: boolean): string {
  if (!audioTagsEnabled) return "";
  return `
- The script currently uses audio direction tags from this list: ${ALL_AUDIO_TAGS.map((t) => `[${t}]`).join(", ")}.
- Preserve any existing tags in the segment and add or adjust tags only where they genuinely improve delivery.`;
}

export interface RefinementPromptInput {
  segment: ScriptSegment;
  allSegments: ScriptSegment[];
  instruction: string;
  actionType: FeedbackActionType;
  draft: Draft;
  preferences: AggregatedPreferences | null;
  audioTagsEnabled?: boolean;
}

export function buildRefinementPrompt(input: RefinementPromptInput) {
  const { segment, allSegments, instruction, draft, preferences, audioTagsEnabled } = input;

  const system = `You are an elite short-form content editor. You rewrite a single segment of a social media script based on precise feedback.

Rules:
- Only rewrite the provided segment. Do not rewrite the other segments.
- Preserve the original meaning and context unless the user explicitly asks to change it.
- Match the overall tone and style of the script.
- Return only the new text for the segment, with no labels, JSON, or extra commentary.
${buildAudioTagPreservationNote(audioTagsEnabled)}
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
  audioTagsEnabled?: boolean;
}

export function buildThoughtIntegrationPrompt(input: ThoughtIntegrationPromptInput) {
  const { segment, allSegments, thought, draft, preferences, audioTagsEnabled } = input;

  const system = `You are an elite short-form content editor. A user has a thought they want you to gracefully integrate into a specific segment of a social media script.

Rules:
- Weave the thought into the segment naturally. Do not bolt it on awkwardly.
- Preserve the segment's original role and meaning unless the thought explicitly changes it.
- Keep the surrounding script flow and context in mind.
- Match the requested tone, style, and target length.
- Return ONLY the rewritten segment text. No labels, JSON, or extra commentary.
${buildAudioTagPreservationNote(audioTagsEnabled)}
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
    case "refinement:grammar":
      return "Correct only grammar, spelling, and punctuation in this segment. Do NOT change word choice, tone, ideas, or meaning. Preserve all audio tags and the exact flow of the segment.";
    case "refinement:less_salesy":
      return "Rewrite this segment to remove marketing hype, aggressive calls to action, and pushy sales language. Keep the core message and value proposition intact, but make it sound helpful, honest, and conversational — like advice from a trusted friend rather than a salesperson. Avoid phrases like 'act now', 'limited time', 'don't miss out', and exaggerated claims.";
    case "refinement:dont_like":
      return "Rewrite this segment completely. The current version is not working. Try a fresh, stronger angle.";
    default:
      return "Improve this segment.";
  }
}

export interface VisualPromptInput {
  segment: ScriptSegment;
  allSegments: ScriptSegment[];
  style: string;
  draft: Draft;
}

export function buildVisualPrompt(input: VisualPromptInput) {
  const { segment, allSegments, style, draft } = input;

  const system = `You are a concise visual director for short-form social media content.
Your job is to write a single, short visual prompt (1-2 sentences) that describes what appears on screen while the narrator reads a specific script segment.

Rules:
- Keep it short, specific, and easy to shoot or source.
- Match the visual style the user selected.
- Do not describe dialogue or narration.
- Do not use markdown, labels, JSON, or extra commentary.
- Return only the visual prompt text.`;

  const fullScriptContext = allSegments
    .map((s) => `[${SEGMENT_LABELS[s.type]}]: ${s.text}`)
    .join("\n\n");

  const user = `Full script for context:

${fullScriptContext}

---

Segment: [${SEGMENT_LABELS[segment.type]}]: ${segment.text}

Visual style: ${style}

Tone: ${TONE_LABELS[draft.tone]}
Style: ${STYLE_LABELS[draft.style]}

Write a 1-2 sentence visual prompt for this segment in the "${style}" style. Return only the visual prompt text.`;

  return { system, user };
}

export function parseScriptJson(raw: string): { title: string; segments: { type: SegmentType; text: string; visualPrompt: string }[] } | null {
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
          .map((s: { type: string; text: string; visualPrompt?: string }) => ({
            type: s.type as SegmentType,
            text: s.text.trim(),
            visualPrompt: (s.visualPrompt ?? "").trim(),
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
  audioTagsEnabled?: boolean;
}

/**
 * Default prompt used to generate segment variations.
 * Edit this function in lib/ai/prompts.ts if you want to change the AI instructions.
 */
export function buildSegmentVariationsPrompt(input: SegmentVariationsPromptInput) {
  const { segment, allSegments, draft, preferences, audioTagsEnabled } = input;

  const system = `You are an elite short-form content marketer.
Your task is to generate 3 strong variations of a single segment from a social media script.

Rules:
- Each variation must fit the segment's role (${SEGMENT_LABELS[segment.type]}).
- Variations should feel different from each other (e.g. angle, energy, opening word, emotional hook).
- Keep them roughly the same length as the original.
- Match the requested tone and style.
- Do not use emojis unless they genuinely add clarity.
- The segment text may contain spaces, punctuation, and special characters. Return the text exactly as a JSON string with proper escaping.
${buildAudioTagPreservationNote(audioTagsEnabled)}
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

Generate 3 alternative versions of this segment. Categorize each variation by its dominant approach. Return ONLY a JSON object with this structure:
{
  "variations": [
    { "label": "Angle 1", "category": "emotional", "text": "..." },
    { "label": "Angle 2", "category": "rational", "text": "..." },
    { "label": "Angle 3", "category": "curiosity", "text": "..." }
  ]
}

Use one of these categories for each variation: emotional, rational, curiosity, urgent, storytelling, bold, intimate, funny.
Make sure the "text" value is a valid JSON string — preserve spaces, punctuation, and line breaks with \\n.`;

  return { system, user };
}

export interface SegmentVariation {
  label: string;
  text: string;
  category?: string;
}

export function parseVariationsJson(raw: string): SegmentVariation[] | null {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : raw;
    const parsed = JSON.parse(jsonStr);
    if (parsed && Array.isArray(parsed.variations)) {
      return parsed.variations
        .filter((v: { text?: string }) => v.text)
        .map((v: { label?: string; category?: string; text: string }) => ({
          label: v.label || "Variation",
          category: v.category || "variation",
          text: v.text.trim(),
        }));
    }
  } catch {
    // ignore
  }
  return null;
}

export interface AudioTagPromptInput {
  script: Script;
  draft: Draft;
  preferences: AggregatedPreferences | null;
}

export function buildAudioTagPrompt(input: AudioTagPromptInput) {
  const { script, draft, preferences } = input;

  const system = `You are an expert voiceover director for short-form social media videos.
Your job is to take an existing script and insert audio delivery tags to guide the narrator's tone, energy, reactions, pacing, and rhythm.

Rules:
- Only use tags from this exact list: ${ALL_AUDIO_TAGS.map((t) => `[${t}]`).join(", ")}.
- Place tags inline, right before the words they affect. Tags can be layered, e.g. "[NERVOUS] I... I’m not sure this is going to work. [GULPS] But let’s try anyway."
- Do NOT change the words, ideas, or meaning of the script. Only add, remove, or reposition tags.
- Preserve each segment's exact wording and sentence structure. The final text must contain every word from the original in the same order.
- Match the requested tone (${TONE_LABELS[draft.tone]}) and style (${STYLE_LABELS[draft.style]}).
- Tags should feel natural for a spoken voiceover, not random or excessive.
- Respond with a JSON object only, preserving the original segment types and order.`;

  const segmentList = script.segments
    .map(
      (s) =>
        `{ "type": "${s.type}", "text": ${JSON.stringify(stripAudioTags(s.text))} }`
    )
    .join(",\n");

  const user = `Here is the script to tag:
[
${segmentList}
]

Tone: ${TONE_LABELS[draft.tone]}
Style: ${STYLE_LABELS[draft.style]}
${buildPersonalizationNote(preferences)}

Return ONLY a JSON object with this structure:
{
  "segments": [
    { "type": "hook", "text": "[EXCITED] ..." },
    ...
  ]
}`;

  return { system, user };
}

export interface SegmentAudioTagPromptInput {
  segment: ScriptSegment;
  draft: Draft;
  preferences: AggregatedPreferences | null;
  previousVariations?: string[];
}

export function buildSegmentAudioTagPrompt(input: SegmentAudioTagPromptInput) {
  const { segment, draft, preferences, previousVariations } = input;

  const system = `You are an expert voiceover director for short-form social media videos.
Your job is to insert audio delivery tags into a SINGLE segment of an existing script.
Only use tags from this exact list: ${ALL_AUDIO_TAGS.map((t) => `[${t}]`).join(", ")}.

Rules:
- Place tags inline, right before the words they affect.
- Do NOT change the words, ideas, or meaning of the segment. Only add, remove, or reposition tags.
- Preserve the segment's exact wording and sentence structure. The final text must contain every word from the original in the same order.
- Match the requested tone (${TONE_LABELS[draft.tone]}) and style (${STYLE_LABELS[draft.style]}).
- Tags should feel natural for a spoken voiceover, not random or excessive.
- Respond with a JSON object only, preserving the original segment type and order.`;

  const previousNote = previousVariations?.length
    ? `\n\nPreviously generated tag variations (do NOT reproduce any of these; create a distinctly different placement/choice of tags):\n${previousVariations.map((v, i) => `${i + 1}. ${v}`).join("\n")}`
    : "";

  const user = `Segment to tag:
{ "type": "${segment.type}", "text": ${JSON.stringify(stripAudioTags(segment.text))} }

Tone: ${TONE_LABELS[draft.tone]}
Style: ${STYLE_LABELS[draft.style]}
${buildPersonalizationNote(preferences)}${previousNote}

Return ONLY a JSON object with this structure:
{
  "segments": [
    { "type": "${segment.type}", "text": "[TAG] ..." }
  ]
}`;

  return { system, user };
}

export function parseAudioTaggedSegmentsJson(
  raw: string
): { type: SegmentType; text: string }[] | null {
  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : raw;
    const parsed = JSON.parse(jsonStr);
    if (parsed && Array.isArray(parsed.segments)) {
      return parsed.segments
        .filter((s: { type?: string; text?: string }) => s.type && s.text)
        .map((s: { type: string; text: string }) => ({
          type: s.type as SegmentType,
          text: s.text.trim(),
        }));
    }
  } catch {
    // ignore
  }
  return null;
}

const AUDIO_TAG_PATTERN = new RegExp(
  `\\[(${ALL_AUDIO_TAGS.join("|")})\\]`,
  "g"
);

export function stripAudioTags(text: string): string {
  return text.replace(AUDIO_TAG_PATTERN, "").replace(/\s+/g, " ").trim();
}

export function hasAudioTags(text: string): boolean {
  return AUDIO_TAG_PATTERN.test(text);
}

export function normalizeAudioTagText(text: string): string {
  // Normalize spacing around tags so "word [TAG] word" and "word  [TAG] word" are treated the same.
  return text
    .replace(AUDIO_TAG_PATTERN, "[$1]")
    .replace(/\s*\[/g, " [")
    .replace(/\]\s*/g, "] ")
    .replace(/\s+/g, " ")
    .trim();
}

export function getAudioTagSignature(text: string): string {
  // Extract just the tags and their positions relative to words for comparison.
  const tags = text.match(AUDIO_TAG_PATTERN) || [];
  return tags.join(" ");
}
