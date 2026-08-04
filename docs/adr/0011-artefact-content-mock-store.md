# ADR 0011 — Phase-2 artefact content: mock store, supported types, style-ref scope

**Status:** Accepted (contract v0.4, no bump — no seam signature changed)

## Context

Milestone 3 turns `generateArtefacts` (Phase 2) from a stub into real, style-conditioned
per-lesson content, for a `validated` course. The `CourseEngine` interface (Seam 1) already
had this method's signature since M1; nothing about it changes here. But making it real
forces several concrete decisions the contract left as sockets or open items, and one place
where the milestone brief explicitly asked for a design note the architect should confirm.
Recording them here rather than letting them be silent implementation choices.

## Decisions

### 1. `Artefact.contentRef` scheme and the mock content store

`Artefact.contentRef` is documented as "a socket: pointer to stored content (never a raw
blob in a row)" — invariant 3 forbids inlining generated content into the `Course` row.
Real storage target is explicitly **Open Item 1** in the integration contract (§8, still
unresolved: Supabase Storage vs. table vs. object store).

At MVP: a second process-level in-memory store, `src/modules/engine/infrastructure/
contentStore.ts`, keyed by `contentRef`. Same reasoning as `courseStore.ts` (ADR 0009's
consequence) — `getCourseEngine()` returns a new engine instance per call, so content can't
live on `this`; a module-level singleton survives across requests within one process. This
is the Seam-4 mock for artefact content specifically, separate from `courseStore.ts` (which
holds `Course` BUILD state) and unrelated to the SOURCE knowledge cache (Seam 3, untouched).

`contentRef` format: `content://<courseId>/<lessonId>/<type>/<index>`, where `index` is a
deterministic per-(lesson, type) counter seeded from artefacts already on that lesson. This
keeps refs unique across repeat `generateArtefacts` calls on the same course (each call
**appends** new artefacts to `lesson.artefacts` — it does not replace or version earlier
ones; there is no artefact-versioning model at MVP) without needing random ids, and without
one call's targets colliding with each other.

Real storage replaces this behind the same `putContent`/`getContent` shape; nothing above it
changes when that swap happens — same swap contract as every other Seam-4 mock.

### 2. Which artefact types get real content

`generateArtefacts` must "handle at least `textual` and `slide` end to end; other types may
return a clearly-marked not-yet-supported stub rather than failing" (milestone brief). This
is encoded as `SUPPORTED_ARTEFACT_TYPES` in `domain/artefacts.ts` — currently `{textual,
slide}`. A requested type outside that set still produces an `Artefact` (never a thrown
error, and `prefs` is still respected — one artefact per requested type either way), with
content stored as a clearly-prefixed `[not yet supported]` string instead of an LLM call.
Extending real generation to `visual`/`quiz`/`code_challenge`/`presentation` is a matter of
widening this set and the prompt's shape-instructions branch — no contract or store change.

### 3. `Artefact.styleProfileRef` left unset

The field is documented as "which teaching-style profile conditioned it" — but `StyleProfile`
has no identity of its own (no `id`; just `practitionerId` plus the profile fields inline).
There is nothing real to point `styleProfileRef` at yet. Rather than overload it with
`practitionerId` (which identifies the _person_, not _which version of their style profile_
conditioned this specific artefact — a different thing once style profiles are ever
persisted/versioned), this milestone leaves `styleProfileRef` **unset**. Inventing a
reference scheme now would be a made-up convention some later milestone has to un-invent.
Flagging rather than silently deciding, per the socket-field's own uncertainty.

### 4. `StyleProfile.voiceSamplesRef` — best-effort acknowledgement only (the design note flagged for confirmation)

The milestone brief said the prompt must condition on the full `StyleProfile` "including
voiceSamplesRef if present — see the design note the architect will confirm." `voiceSamplesRef`
is a socket ("practitioner's own material for conditioning") with no resolution mechanism
anywhere in the codebase — actually retrieving and injecting real voice-sample content would
be a retrieval concern adjacent to Seam 3 (Knowledge/RAG), which is explicitly out of scope
for M3 ("Cache stays mock — do NOT wire the knowledge cache yet").

**What this milestone actually does:** if `style.voiceSamplesRef` is present, the artefact
prompt (`prompts/artefacts.v1.ts`) includes one line acknowledging that a personal
voice/style reference exists and instructing the model to write as if channelling that
practitioner's voice — but does **not** fetch, resolve, or inject the referenced material
itself. This is the minimum honest thing to do with a field that exists but has no backing
retrieval system yet: acknowledge it, don't fabricate content behind it.

**Flagging for confirmation, not deciding unilaterally:** this is presented as the
architect's call to make, not a settled decision. If real voice-sample conditioning is
wanted before Seam 3 lands, that's a scoped follow-up (likely its own small
retrieval/storage mechanism, possibly foreshadowing Seam 3's shape) — not something to
retrofit into this prompt silently.

### 5. Two more server-barrel exports (not a Seam 1 change)

`server.ts` (ADR 0010's server-only barrel) gains `getCourse` (re-exported from
`courseStore.ts`) and `getArtefactContent` (re-exported from `contentStore.ts`, renamed on
export for clarity). Neither is part of `CourseEngine` — the Seam 1 interface has no "read a
course" or "read artefact content" method, and this ADR does not add one. They exist purely
because `generateArtefacts` returns `Artefact[]` (contentRef pointers, never raw content),
so there is no other way for a server-side test (or, later, an internal route) to verify
that generated artefacts actually attached to the right lesson, or to read the content behind
a `contentRef` — both of which the milestone's own DoD requires observing (mock: "contentRef
populated"; live: "PRINTS the content"). Consistent with ADR 0010: the module's internal
export surface can grow without touching the frozen `CourseEngine` contract.

## Consequences

- No contract version bump — `CourseEngine.generateArtefacts`'s signature is unchanged; only
  its (previously stubbed) implementation became real.
- Two open items remain genuinely open, not accidentally foreclosed: real artefact content
  storage (integration-contract.md §8 Open Item 1) and real voice-sample conditioning both
  still need a real decision before they can be more than a mock/acknowledgement.
- `styleProfileRef` staying unset means nothing downstream can rely on it yet — that's
  intentional; a future milestone that gives `StyleProfile` real identity should populate it
  then, not have this milestone guess at the shape.
