# ADR 0009 — `approveCurriculum` added to Seam 1 (contract v0.4)

**Status:** Accepted (contract v0.4)

## Context
ADR 0004 established the two-phase generation gate: `generateArtefacts` (Phase 2) is forbidden
unless `course.status === 'validated'`. Milestone 1 shipped Phase 1 (`generateCurriculum`) and a
partial `refineCurriculum` (remove only, mock-only). Nothing in the contract let a practitioner
actually cross the `draft → validated` line — the gate existed but had no door. Milestone 2 closes
that: a full refine loop (add/remove/update/regenerate) plus the approval call that opens Phase 2.

Approval is a genuine seam-signature change, not a design-layer choice — the UI (and the real
website later) needs a call it can make. It belongs on `CourseEngine` (Seam 1), not buried inside
`refineCurriculum`, because approval is a distinct, irreversible-in-intent action (a status
transition with its own audit/analytics meaning — see Seam 6 `artefact_approved`-style events,
deferred), not another edit op.

## Decision
Add one method to `CourseEngine`:

```ts
approveCurriculum(courseId: string): Promise<Course>; // draft -> validated
```

- Asserts the course is `draft` (via the existing `canTransition` ladder guard — no new transition
  logic; `draft → validated` was already the next step in `generating → draft → validated →
  published`).
- Persists the transitioned course and returns it.
- Implemented identically on `MockCourseEngine` and `LiveCourseEngine` — the check and the ladder
  are the same regardless of `AI_MODE`; only Phase 1/2 generation differ mock-vs-live.
- `refineCurriculum` is permitted only while `status === 'draft'`; once approved, further edits are
  rejected (a practitioner who wants to change an approved curriculum re-opens it via a future
  `draft`-reopen path, out of scope here — see Open Items).

This is the one contract change in Milestone 2. Bumps the integration contract to **v0.4**
(seam-signature change, per the versioning rule clarified alongside this ADR: the version tracks
seam signatures, not additive config/env changes — see the v0.3 changelog entry / ADR 0008).

## Consequences
- The human-approval half of the two-phase gate (ADR 0004) is now real: `generateArtefacts` throws
  before this call and succeeds after, provably, not just by convention.
- Draft persistence had to become process-level (not per-`CourseEngine`-instance) for this to work
  across separate API calls — see `src/modules/engine/infrastructure/courseStore.ts`, documented as
  the Seam-4 mock (Supabase replaces it later behind the same shape; no seam change).
- No new seam was introduced — this is Seam 1 only. Seams 2/3/5/6 are untouched.

## Open items
- Re-opening an already-`validated` course for further edits (`validated → draft`, or a separate
  edit-after-approval path) is not modelled — out of scope for M2, flag if the website needs it.
