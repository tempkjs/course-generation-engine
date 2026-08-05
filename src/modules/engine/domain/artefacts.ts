// Pure domain: planning which (lesson x type) artefacts Phase 2 generates, and attaching a
// generated Artefact back into the course tree. No I/O — the LLM call and content storage
// live in application/generateArtefacts.ts.
import type { Artefact, ArtefactType, Course, Lesson } from "@/contracts";

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
