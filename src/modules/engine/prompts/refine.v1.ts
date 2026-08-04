// Refine-loop 'regenerate' prompt — versioned per prompt-governance rule (never edited in
// place). A new behaviour is a new prompt version (refine.v2.ts, ...), not an edit to this file.

export const REFINE_PROMPT_VERSION = 'refine.v1';

export interface RefineContext {
  kind: 'module' | 'lesson';
  courseTitle: string;
  field: string;
  currentTitle: string;
  currentSummary?: string; // modules only
  currentObjectives?: string[]; // lessons only
  instruction?: string;
}

export function buildRefinePrompt(ctx: RefineContext): string {
  const currentState =
    ctx.kind === 'module'
      ? `Current summary: ${ctx.currentSummary ?? '(none)'}`
      : `Current objectives: ${JSON.stringify(ctx.currentObjectives ?? [])}`;

  const responseShape =
    ctx.kind === 'module'
      ? `{ "title": "string", "summary": "string" }`
      : `{ "title": "string", "objectives": ["string", "..."] }`;

  return `You are an experienced learning & development (L&D) manager. A practitioner is
refining ONE ${ctx.kind} of an existing course curriculum, in place. Regenerate ONLY this
${ctx.kind} — do not redesign the surrounding course, and keep it consistent in scope and
level with the rest of the curriculum.

Course: "${ctx.courseTitle}" (field: ${ctx.field})
Current ${ctx.kind} title: "${ctx.currentTitle}"
${currentState}

${
  ctx.instruction
    ? `Practitioner instruction: ${ctx.instruction}`
    : 'No specific instruction was given — produce a meaningfully improved, field-appropriate revision (sharper title, better-scoped content) rather than a trivial rewording.'
}

Return ONLY a single JSON object — no markdown code fences, no commentary before or after —
matching exactly this shape:

${responseShape}`;
}
