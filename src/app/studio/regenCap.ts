// Per-node regenerate cap — session-scoped (in-memory), studio-page-local UI/config state.
// No contract change: this gates the studio UI's own calls to refineCurriculum's 'regenerate'
// edit and to generateArtefacts, it does not change either seam signature.
//
// Shared by curriculum node regenerate AND per-lesson artefact (re)generation — the two use
// disjoint key namespaces (see artefactRegenKey) so generating a lesson's material doesn't
// consume that same lesson's curriculum-node regenerate budget, and vice versa.
export const MAX_REGENERATIONS_PER_NODE = 2;

export type RegenCounts = Record<string, number>;

export function regenCountFor(counts: RegenCounts, key: string): number {
  return counts[key] ?? 0;
}

export function canRegenerate(counts: RegenCounts, key: string): boolean {
  return regenCountFor(counts, key) < MAX_REGENERATIONS_PER_NODE;
}

/** Pure — returns a new counts map with `key` incremented. */
export function recordRegen(counts: RegenCounts, key: string): RegenCounts {
  return { ...counts, [key]: regenCountFor(counts, key) + 1 };
}

/** Namespaces artefact (re)generation counts away from curriculum node regenerate counts. */
export function artefactRegenKey(lessonId: string): string {
  return `artefact:${lessonId}`;
}

export const HANDOFF_MESSAGE =
  "It seems we're not able to generate the right version of this topic. Please drop " +
  "detailed feedback below — we'll use it to improve our responses. In the meantime, we " +
  "recommend creating the content for this topic yourself.";
