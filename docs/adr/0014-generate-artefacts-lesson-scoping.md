# ADR 0014 — `generateArtefacts` lesson scoping (Seam 1 change → contract v0.5)

**Status:** Accepted. Implemented now (seals M3).

## Context

`generateArtefacts(courseId, prefs, style)` generates for **every lesson** in the course,
each call. The CA/GST validation had to _destructively trim_ the course to one lesson (via
`remove` edits) just to validate a single lesson's artefacts — a workaround, flagged twice
across the last two runs as a real seam gap. At delivery time, a practitioner iterating on
one lesson ("I tweaked lesson 3, regenerate just that") is a core interaction of the
practitioner-in-the-loop model — whole-course-only regeneration is wrong for it and
expensive.

## Decision

Add **optional lesson scoping** to `generateArtefacts`. Omitted ⇒ whole course (backward
compatible); provided ⇒ only those lessons. This is a genuine Seam 1 signature change →
**contract v0.5** (a correct, real bump — the seam was under-specified and use revealed it).

```ts
export interface GenerateArtefactsOpts {
  lessonIds?: string[]; // omitted => all lessons; [] is an error (ambiguous, not "none")
}

generateArtefacts(
  courseId: string,
  prefs: ArtefactType[],
  style: StyleProfile,
  opts?: GenerateArtefactsOpts,
): Promise<Artefact[]>
```

## Rejected alternative

Keep whole-course-only and trim (the test workaround). Rejected: destructive edits to scope
generation is wrong at delivery, wasteful in tokens, and forces the practitioner to mutate
their course structure to regenerate one lesson's material.

## Consequences

- Contract → v0.5; ADR + changelog. Both `MockCourseEngine` and `LiveCourseEngine` honour
  the scope; mock stays deterministic. Optional param ⇒ existing call sites unaffected.
- Kills the trim workaround in `tests/live.ca-gst.test.ts` — it scopes directly now.

## Open decision (architect to confirm at build) — resolved

Exact opts shape: `lessonIds?: string[]` vs a single `lessonId?`. **Resolved as
recommended:** `lessonIds?: string[]` (a practitioner may regenerate a few lessons at
once). `opts.lessonIds === []` throws (ambiguous — "target nothing" is never what a caller
means; omit the option entirely to mean "all lessons"). A `lessonIds` entry that doesn't
match any lesson in the course is not separately validated — it simply contributes no
targets, the same as any other empty-intersection filter.

## Build note

Implemented in `domain/artefacts.ts` (`planArtefactTargets` gained a `lessonIds?` filter
parameter), `application/generateArtefacts.ts` (the empty-array validation, and the
`lessonIds` pass-through), both `MockCourseEngine`/`LiveCourseEngine`, `CourseEngineClient`,
and `POST /api/generate-artefacts`. `tests/live.ca-gst.test.ts` no longer trims the course —
it calls `generateArtefacts(courseId, prefs, style, { lessonIds: [targetLesson.id] })`
directly on the full, untrimmed, approved 6-module curriculum.
