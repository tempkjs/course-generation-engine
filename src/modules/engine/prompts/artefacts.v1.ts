// Phase-2 artefact-content prompt — versioned per prompt-governance rule (never edited in
// place). A new behaviour is a new prompt version (artefacts.v2.ts, ...), not an edit here.
import type { ArtefactType, StyleProfile } from "@/contracts";

export const ARTEFACT_PROMPT_VERSION = "artefacts.v1";

export interface ArtefactPromptContext {
  type: ArtefactType;
  courseTitle: string;
  field: string;
  lessonTitle: string;
  lessonObjectives: string[];
  style: StyleProfile;
}

function styleBlock(style: StyleProfile): string {
  const lines = [
    `Tone: ${style.tone}`,
    `Depth: ${style.depth}`,
    `Preferred modalities: ${style.modalities.join(", ") || "unspecified"}`,
  ];
  if (style.voiceSamplesRef) {
    // Best-effort acknowledgement only — resolving actual voice-sample content from this
    // reference is a retrieval concern (Seam-3-adjacent), out of scope for M3. Flagged for
    // the architect in ADR 0011; not a design decision this prompt should make silently.
    lines.push(
      `The practitioner has a personal voice/style reference on file (ref: ${style.voiceSamplesRef}) — write as if channelling that practitioner's own voice, not a generic instructor's.`,
    );
  }
  return lines.join("\n");
}

export function buildArtefactPrompt(ctx: ArtefactPromptContext): string {
  const header = `You are ghostwriting course material AS the practitioner who owns this course — the output should read like it came from them, not a generic AI assistant. Produce ONE ${ctx.type} artefact for a single lesson.

Course: "${ctx.courseTitle}" (field: ${ctx.field})
Lesson: "${ctx.lessonTitle}"
Lesson objectives:
${ctx.lessonObjectives.map((o) => `- ${o}`).join("\n") || "(none specified)"}

Practitioner's teaching style — match this deliberately; tone and depth should be visibly, not subtly, different from a generic default:
${styleBlock(ctx.style)}`;

  const shapeInstructions =
    ctx.type === "slide"
      ? `Produce a slide-by-slide outline for this lesson. Plain text, no markdown code fences. One slide per block, in this shape:

Slide 1: <slide title>
- <bullet>
- <bullet>

Slide 2: <slide title>
- <bullet>
...

5-8 slides is typical for a single lesson; adjust to the depth setting above (overview = fewer, denser slides; deep = more, granular slides).`
      : `Produce the lesson's textual teaching content: the material a learner reads to actually learn the lesson's objectives, not just a summary of them. Plain prose, structured with short paragraphs and/or subheadings as appropriate. Length and rigor should match the depth setting above.`;

  return `${header}\n\n${shapeInstructions}\n\nReturn ONLY the artefact content itself — no preamble, no meta-commentary about what you're about to write, no markdown code fences.`;
}
