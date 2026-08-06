// Pure domain: planning which (lesson x type) artefacts Phase 2 generates, attaching a
// generated Artefact back into the course tree, parsing the artefacts prompt's response
// envelope (the { content, flaggedClaims } shape introduced by artefacts.v2, unchanged since
// — ADR 0013), and deriving a verification checklist from a set of artefacts. No I/O — the
// LLM call and content storage live in application/generateArtefacts.ts.
import type {
  Artefact,
  ArtefactType,
  Course,
  FlaggedClaim,
  Lesson,
} from "@/contracts";
import { extractJsonObject } from "./curriculum";

/**
 * Artefact types Phase 2 generates real, style-conditioned content for. A requested type
 * outside this set still gets an Artefact back (never a thrown error) — just with a
 * clearly-marked stub in place of real content. See ADR 0011.
 */
export const SUPPORTED_ARTEFACT_TYPES: ReadonlySet<ArtefactType> = new Set([
  "textual",
  "slide",
]);

export interface ArtefactTarget {
  lesson: Lesson;
  type: ArtefactType;
}

/**
 * One target per (lesson x requested type). Every lesson in the course, unless `lessonIds`
 * narrows it (ADR 0014, v0.5) — validating that `lessonIds` isn't an empty array is the
 * application layer's job (a use-case/input-validation concern), not this pure planner's;
 * an empty `lessonIds` here just produces zero targets, same as any other filter.
 */
export function planArtefactTargets(
  course: Course,
  prefs: ArtefactType[],
  lessonIds?: string[],
): ArtefactTarget[] {
  const scope = lessonIds ? new Set(lessonIds) : undefined;
  const targets: ArtefactTarget[] = [];
  for (const mod of course.modules) {
    for (const lesson of mod.lessons) {
      if (scope && !scope.has(lesson.id)) continue;
      for (const type of prefs) {
        targets.push({ lesson, type });
      }
    }
  }
  return targets;
}

/** Attach a generated artefact to its lesson within the course tree. Pure, no I/O. */
export function attachArtefact(
  course: Course,
  lessonId: string,
  artefact: Artefact,
): Course {
  return {
    ...course,
    modules: course.modules.map((m) => ({
      ...m,
      lessons: m.lessons.map((l) =>
        l.id === lessonId ? { ...l, artefacts: [...l.artefacts, artefact] } : l,
      ),
    })),
  };
}

const VALID_CLAIM_TYPES: ReadonlySet<FlaggedClaim["type"]> = new Set([
  "citation",
  "date",
  "unsettled",
  "figure",
  "product",
  "other-nonstatic",
]);

function isFlaggedClaim(value: unknown): value is FlaggedClaim {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.type === "string" &&
    VALID_CLAIM_TYPES.has(v.type as FlaggedClaim["type"]) &&
    typeof v.text === "string" &&
    v.text.trim().length > 0 &&
    (v.note === undefined || typeof v.note === "string")
  );
}

export interface ParsedArtefactContent {
  content: string;
  flaggedClaims: FlaggedClaim[];
}

/**
 * Parse an artefacts prompt response — a `{ content, flaggedClaims }` JSON envelope,
 * introduced by artefacts.v2 and unchanged since (ADR 0013).
 * Falls back to treating the raw text as content when it isn't parseable JSON (e.g.
 * MockLlmProvider's canned string, or a live response that didn't follow the envelope) —
 * and, since we can no longer trust any per-claim flags the model may have intended,
 * attaches ONE defensive `other-nonstatic` flag covering the whole response rather than
 * silently reporting zero claims. A regenerate/generate loop shouldn't fail just because a
 * response wasn't structured, and it must never look falsely clean when unparsed.
 */
export function parseArtefactResponse(raw: string): ParsedArtefactContent {
  try {
    const parsed = extractJsonObject(raw) as Record<string, unknown>;
    const content =
      typeof parsed.content === "string" && parsed.content.trim()
        ? parsed.content
        : raw.trim();
    const flaggedClaims = Array.isArray(parsed.flaggedClaims)
      ? parsed.flaggedClaims.filter(isFlaggedClaim)
      : [];
    return { content, flaggedClaims };
  } catch {
    return {
      content: raw.trim(),
      flaggedClaims: [
        {
          type: "other-nonstatic",
          text: raw.trim().slice(0, 80),
          note: "response was not a parseable artefacts.v2 JSON envelope — flagged defensively in full, verify manually",
        },
      ],
    };
  }
}

export interface VerificationChecklist {
  totalClaims: number;
  byType: Partial<Record<FlaggedClaim["type"], number>>;
  claims: FlaggedClaim[];
}

/**
 * Derives a lesson/course-level verification checklist from the union of flaggedClaims
 * across a set of artefacts (ADR 0013) — a derivation, not a stored contract field. Pass one
 * lesson's artefacts for a lesson-level checklist, or every artefact in a course for a
 * course-level one; this function doesn't care which.
 */
export function buildVerificationChecklist(
  artefacts: Artefact[],
): VerificationChecklist {
  const claims = artefacts.flatMap((a) => a.flaggedClaims);
  const byType: Partial<Record<FlaggedClaim["type"], number>> = {};
  for (const claim of claims) {
    byType[claim.type] = (byType[claim.type] ?? 0) + 1;
  }
  return { totalClaims: claims.length, byType, claims };
}
