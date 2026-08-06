// Phase-2 artefact-content prompt v2 — versioned per prompt-governance rule (never edited in
// place; v1 stays as-is for history). Supersedes v1 on two decisions recorded in ADR 0013:
//
// Decision 2 (prevention, not detection): artefacts are IMPERSONAL REFERENCE MATERIAL — a
// handout/slide deck a practitioner hands learners — never a first-person transcript, and
// never a fabricated anecdote or invented statistic presented as lived experience. v1's
// "ghostwriting AS the practitioner" framing produced exactly that failure mode live (first
// person throughout, invented rupee figures) — this version replaces the framing, not patches
// it in place.
//
// Decision 1 (in-generation claim flagging): the SAME call that produces content also
// returns the non-static claims within it — case/authority citations, dates, unsettled
// points, rates/thresholds/figures, named products/vendors, anything else asserting current
// status. Flagged by NATURE, not by the model's confidence. No separate pass, no extra call.
import type { ArtefactType, StyleProfile } from "@/contracts";

export const ARTEFACT_PROMPT_VERSION = "artefacts.v2";

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
    // reference is a retrieval concern (Seam-3-adjacent), out of scope here (ADR 0011). And
    // even once resolved, it conditions STYLISTIC preference (structure, terminology), never
    // first-person narration — Decision 2 below is absolute regardless of this reference.
    lines.push(
      `The practitioner has a personal style reference on file (ref: ${style.voiceSamplesRef}) — once resolved this should inform structural/terminology preferences, never license first-person narration.`,
    );
  }
  return lines.join("\n");
}

function shapeInstructions(ctx: ArtefactPromptContext): string {
  return ctx.type === "slide"
    ? `Slide-by-slide outline for this lesson, as plain text inside the "content" field (use \\n for line breaks, no markdown code fences). One slide per block, in this shape:

Slide 1: <slide title>
- <bullet>
- <bullet>

Slide 2: <slide title>
- <bullet>
...

5-8 slides is typical for a single lesson; adjust to the depth setting above (overview = fewer, denser slides; deep = more, granular slides, more caveats per point).`
    : `The lesson's textual reference content, as plain prose inside the "content" field (use \\n for line breaks): the material a learner reads to actually learn the lesson's objectives, not just a summary of them. Short paragraphs and/or subheadings as appropriate. Length, technical completeness, and caveating should match the depth setting above — "deep" means more edge cases and more explicit caveats covered, not a different narrator.`;
}

export function buildArtefactPrompt(ctx: ArtefactPromptContext): string {
  return `Produce ONE ${ctx.type} artefact — IMPERSONAL REFERENCE MATERIAL, like a handout or
slide deck a practitioner hands to learners, NOT a transcript of someone talking. This is the
single most important instruction below; everything else refines it.

Course: "${ctx.courseTitle}" (field: ${ctx.field})
Lesson: "${ctx.lessonTitle}"
Lesson objectives:
${ctx.lessonObjectives.map((o) => `- ${o}`).join("\n") || "(none specified)"}

Practitioner's teaching style — this conditions RIGOR, THOROUGHNESS, TECHNICAL COMPLETENESS,
and CAVEATING. It never conditions persona or voice. "${ctx.style.tone}" tone / "${ctx.style.depth}" depth means MORE complete and MORE explicitly caveated content, not content written in a "${ctx.style.tone}"-sounding voice:
${styleBlock(ctx.style)}

## Hard rules — impersonal, no fabrication (absolute, override anything above if they conflict)

1. NEVER use first person: no "I", "my", "in my experience", "I've seen", "I insist", "I
   want to be direct," or any variant. Write in third person / imperative / declarative —
   "Practitioners should...", "This is commonly...", "Verify that...", never "In my
   experience...".
2. NEVER invent an anecdote, a war story, or a specific-sounding statistic presented as
   lived experience (e.g. "in practice this runs 30-40% of cases," "typically ±₹5,000 per
   vendor," "I've seen this trip up half my clients"). If there is no real, citable basis for
   a specific figure, do not state a specific figure — describe the factor qualitatively, or
   omit it.
3. Rule 1/2 do not ban real, attributable specifics — a genuine statutory figure, date, or
   citation is expected and welcome. Every one of those must also appear in flaggedClaims
   below. Fabricated specificity is banned; real, flagged specificity is the goal.

## Claim flagging — flag by NATURE, not by your confidence

Alongside the content, identify every claim in it that is a NON-STATIC fact — anything that
is not a settled, timeless, structural fact. Flag it regardless of how confident you are that
you got it right; flagging is about the KIND of claim, not a correctness judgment. Flag, at minimum, every instance of:

- **citation** — any named case, ruling, authority, or precedent
- **date** — any specific date, deadline, or "as of" / effective-from point
- **unsettled** — any point not yet settled by an authoritative body (live litigation,
  disputed interpretation, pending amendment)
- **figure** — any rate, threshold, monetary amount, percentage, or numeric limit
- **product** — any named product, vendor, platform, or software
- **other-nonstatic** — anything else asserting current status ("recent," "latest," "as
  amended," "w.e.f.," a version/standard number) that doesn't fit the above

When genuinely nothing in the content is non-static, flaggedClaims is []. For most real
reference material on a regulated or technical topic, that will be rare.

## Content shape

${shapeInstructions(ctx)}

## Output format — a single JSON object, nothing else

Return ONLY a single JSON object — no markdown code fences, no commentary before or after —
matching exactly this shape:

{
  "content": "the full artefact content as one string",
  "flaggedClaims": [
    {
      "type": "citation" | "date" | "unsettled" | "figure" | "product" | "other-nonstatic",
      "text": "the exact phrase from content that makes this claim",
      "note": "optional short note on what to verify"
    }
  ]
}`;
}
