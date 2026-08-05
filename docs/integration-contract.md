# Swakojo Academy — Integration Contract & Architecture Boundaries

**Status:** Decided — working reference · **Contract version:** v0.5

> Canonical source: this file, in the repo. Any copy elsewhere is a dated snapshot, not
> authoritative. (ADR 0016)

**Sits under:** `SAKOS` (constitution) · **Sibling of:** `swakojo-academy-revenue-model.md`
**Governs:** every assembly line that builds any part of the course generation engine.

_This is the jig. Different tools build different parts on different assembly lines (Bolt for the UI shell; Claude Code + a custom backend for the engine, cache orchestration, and BI; bought services for the LLM, RAG infrastructure, LMS, and database). Assembly only works if every part is cut to a shared spec — so this document defines the **seams** where the parts meet. Every assembly-line prompt must cite this file and build **only to its assigned seams**. Integration then becomes snapping parts together, not surgery._

**The anti-pattern this exists to prevent** is already visible in the first vibe-coded CMS: its fake engine was imported directly into the components, and generated content was written straight into course rows. There was no seam — so plugging a real engine in would be surgery, not a swap. This contract forbids that.

---

## 1. The layer map (who owns each part)

From the architecture diagram, four dispositions:

| Layer                                                                            | Disposition                        | MVP choice                                    |
| -------------------------------------------------------------------------------- | ---------------------------------- | --------------------------------------------- |
| Authoring CMS (UI)                                                               | **Custom / owned**                 | React + Supabase, scaffolded on Bolt          |
| Course generation engine (orchestrator · style conditioner · artefact generator) | **Custom / owned**                 | Claude Code + custom backend                  |
| Domain knowledge cache                                                           | **Owned data moat**                | your content, on bought infra                 |
| RAG infrastructure                                                               | **Buy / adopt**                    | pgvector on Supabase (or Orq.ai / LlamaIndex) |
| LLM generation                                                                   | **Use via API**                    | Anthropic Claude API                          |
| App database                                                                     | **Buy / adopt**                    | Supabase (Postgres + Auth + RLS)              |
| Delivery / LMS                                                                   | **Buy / adopt**                    | Frappe LMS or Moodle                          |
| Business intelligence                                                            | **Custom / owned** (separate line) | your backend, fed by events                   |

The owned middle (engine + cache + orchestration) is the moat. Everything else is swappable behind a seam.

---

## 2. Two golden rules (every component inherits these)

**Rule A — Source vs Build separation (from SAKOS).** Canonical, reusable knowledge (the cache) and a specific course (an instance) are **two different stores**. A course _references_ source knowledge; it never mutates it. Generation _reads_ source and _writes_ a build; validated builds _feed back_ into source. The compounding flywheel lives entirely in the SOURCE layer — which is why it must be structurally separate, or the "gets faster over time" advantage has nowhere to accrue.

**Rule B — Server-side boundary.** The engine, the LLM keys, the RAG infrastructure, and the knowledge cache are **server-side only**. The browser never holds an API key and never touches the cache. The current CMS ran the "engine" client-side — fine for a fake, fatal for a real one (it would ship your keys and your proprietary cache to every visitor).

---

## 3. Data contracts

The canonical object shapes. All lines build to these. Expressed as TypeScript-style interfaces for clarity; language-neutral in intent. Fields marked `// socket` are integration points wired later — present now, empty/mock.

### 3.1 SOURCE layer — the knowledge cache (owned, reusable, accreting)

```ts
// The unit that accretes in the cache and conditions future generation.
// This is the moat. It is NEVER exposed to the browser.
interface KnowledgeUnit {
  id: string;
  field: Field; // "software" | "hr" | "legal" | "arts" | ...
  domain: string; // finer topic, e.g. "contract-drafting"
  level: Level; // "basic" | "medium" | "advanced"
  curriculumSpine: SpineNode[]; // reusable module/lesson outline (no instance data)
  starterArtefacts: ArtefactSeed[]; // reusable scaffolding / starter kits
  provenance: Provenance; // where it came from, which practitioners refined it
  embeddingRef: string; // socket: vector id in RAG infra
  version: number;
  reuseCount: number; // flywheel signal — how often reused
  qualitySignals: QualitySignal[]; // validation/edit signals that improve retrieval
}

interface SpineNode {
  order: number;
  title: string;
  kind: "module" | "lesson";
  objectives?: string[];
  children?: SpineNode[];
}
interface ArtefactSeed {
  type: ArtefactType;
  skeleton: string;
} // template, not final content
interface Provenance {
  origin: "generated" | "practitioner" | "hybrid";
  contributorIds: string[];
}
interface QualitySignal {
  kind: "approved" | "edited" | "rejected" | "regenerated";
  weight: number;
}
```

### 3.2 BUILD layer — the course instance (disposable)

```ts
interface Course {
  id: string;
  status: "draft" | "generating" | "validated" | "published"; // never skip states
  title: string;
  field: Field;
  level: Level;
  practitionerId: string;
  priceBand: PriceBand; // from revenue model: "short" | "standard" | "intensive"
  cadence: CadenceTemplate; // from revenue model — weekly-slot shape
  isExamPrep?: boolean; // exam vertical flag (raises validation gate)
  sourceRefs: string[]; // KnowledgeUnit ids this course drew from (Rule A)
  modules: Module[];
  publishedLmsId?: string; // socket: set on publish to LMS
  createdAt: string;
}

interface Module {
  id: string;
  order: number;
  title: string;
  summary: string;
  lessons: Lesson[];
}
interface Lesson {
  id: string;
  order: number;
  title: string;
  objectives: string[];
  delivery: "live" | "async"; // live = practitioner hours; async = homework
  artefacts: Artefact[];
}
interface Artefact {
  id: string;
  type: ArtefactType; // "textual" | "visual" | "slide" | "quiz" | "code_challenge" | ...
  contentRef: string; // socket: pointer to stored content (not raw blob in row)
  generatedBy: "engine" | "practitioner";
  styleProfileRef?: string; // which teaching-style profile conditioned it
  approved: boolean; // false until practitioner validates
}
interface Assessment {
  id: string;
  scope: "course" | "lesson";
  type: AssessmentType;
  spec: string;
  contentRef: string;
}
interface Session {
  // a delivered cohort — links to batch (revenue model)
  id: string;
  courseId: string;
  batchId: string;
  slot: string;
  meetingUrl?: string; // socket
}
```

### 3.3 Supporting shapes

```ts
// The teaching-style conditioning input — what makes output "this practitioner", not generic.
interface StyleProfile {
  practitionerId: string;
  modalities: ArtefactType[]; // preferred artefact kinds (textual, visual, ...)
  tone: string;
  depth: "overview" | "working" | "deep";
  voiceSamplesRef?: string; // socket: practitioner's own material for conditioning
}

type Field = string; // open enum, kept broad (multi-disciplinary)
type Level = "basic" | "medium" | "advanced";
type PriceBand = "short" | "standard" | "intensive";
type CadenceTemplate = string; // one of the small fixed weekly-slot shapes
type ArtefactType =
  "textual" | "visual" | "slide" | "quiz" | "code_challenge" | "presentation";
type AssessmentType = "quiz" | "code_challenge" | "presentation" | "assignment";
```

---

## 4. The seams (interfaces between assembly lines)

Six seams. Each is an interface with a **mock implementation now** and a **real one later** — so iteration is a value swap, not a rebuild.

### Seam 1 — UI ↔ Engine (the most important seam)

The UI calls the engine **only through this interface**, fulfilled by a mock now and the real engine later. **Never an in-repo function imported into components.**

```ts
interface CourseEngine {
  generateCurriculum(req: GenerateRequest): Promise<Course>; // status: "generating" -> "draft"
  refineCurriculum(courseId: string, edits: Edit[]): Promise<Course>; // add/remove/update/regenerate loop
  approveCurriculum(courseId: string): Promise<Course>; // status: "draft" -> "validated" (ADR 0009)
  generateArtefacts(
    courseId: string,
    prefs: ArtefactType[],
    style: StyleProfile,
    opts?: GenerateArtefactsOpts, // added v0.5, ADR 0014 — optional lesson scoping
  ): Promise<Artefact[]>;
  commitToCache(courseId: string): Promise<void>; // flywheel write-back — SERVER-SIDE ONLY
}

interface GenerateArtefactsOpts {
  lessonIds?: string[]; // omitted => every lesson in the course; [] is an error
}

interface GenerateRequest {
  topic: string;
  field: Field;
  level: Level;
  audienceExperience: string;
  durationWeeks: number;
  cadence: CadenceTemplate;
  practitionerId: string;
  style: StyleProfile;
}
type Edit =
  | { op: "add"; parentId: string; node: Partial<SpineNode> }
  | { op: "remove"; nodeId: string }
  | { op: "update"; nodeId: string; patch: Partial<SpineNode> }
  | { op: "regenerate"; nodeId: string; instruction?: string };
```

- **Fulfilled by:** your engine line. **Consumed by:** the Bolt CMS line (mock now).
- **Mock now:** a stub returning fixed/plausible drafts behind this exact interface. **Real later:** the orchestrator. The UI never changes.
- **`approveCurriculum` (added v0.4, ADR 0009):** the human-gate half of the two-phase generation
  invariant (B.1). Asserts the course is `draft`, transitions it to `validated` via the same
  `canTransition` ladder guard used everywhere else, persists, and returns the `Course`. Only after
  this call does `generateArtefacts` (Phase 2) become permitted — see invariant 3.
- **`generateArtefacts` lesson scoping (added v0.5, ADR 0014):** `opts.lessonIds` omitted generates
  for every lesson in the course (the original, still-default behaviour); provided, it generates
  only for those lessons — the practitioner-in-the-loop case of regenerating one lesson's material
  without touching the rest. `opts.lessonIds === []` is a caller error (ambiguous — omit the option
  entirely to mean "all lessons," never pass an empty list to mean "none").

### Seam 2 — Engine ↔ LLM (swappable provider)

```ts
interface LlmProvider {
  generate(prompt: string, opts?: GenOpts): Promise<string>;
}
```

- **Buy/use.** Default: Anthropic Claude. Behind an interface so the provider swaps without touching engine logic. **Keys server-side only** (Rule B).

### Seam 3 — Engine ↔ RAG infrastructure ↔ Knowledge cache

```ts
interface KnowledgeRetriever {
  retrieve(query: RetrieveQuery): Promise<KnowledgeUnit[]>;
} // read for conditioning
interface KnowledgeWriter {
  upsert(unit: KnowledgeUnit): Promise<void>;
} // flywheel write-back
interface RetrieveQuery {
  field: Field;
  domain?: string;
  level?: Level;
  text: string;
  topK: number;
}
```

- **Infra bought (pgvector/Supabase, Orq.ai, LlamaIndex); content owned.** The retriever/writer interfaces isolate the infra so it's replaceable. Only the engine (server-side) may call these. The cache is never reachable from the browser.
- **Read-mostly at MVP:** `retrieve` is the hot path; `upsert` is used to _author/curate_ substrates, not to absorb live practitioner edits (Appendix B.2).

### Seam 4 — App ↔ Database (persistence)

- Supabase Postgres. **SOURCE tables and BUILD tables are separate** (Rule A). Owner-scoped **row-level security** (the current CMS did this correctly — keep it).
- **Invariant:** generated content is **never written straight to `course` rows**. It moves through the engine's status states (`generating → draft → validated → published`); only validated content persists as a course, only approved+validated content writes back to the cache.

### Seam 5 — App ↔ LMS (delivery)

```ts
interface LmsAdapter {
  publishCourse(course: Course): Promise<{ lmsCourseId: string }>;
}
```

- **Buy/adopt (Frappe LMS / Moodle).** The app **links out** to the LMS; it never becomes one. Enrollment, payments, login, video-gating, and the learner experience live in the LMS, **not** in anything built on these lines. One adapter per LMS keeps the target swappable.

### Seam 6 — Everything ↔ Business Intelligence (separate line)

```ts
interface EventSink {
  emit(event: DomainEvent): void;
} // fire-and-forget, never in the critical path
type DomainEvent =
  | { kind: "curriculum_generated"; courseId: string }
  | {
      kind: "artefact_approved" | "artefact_rejected" | "artefact_regenerated";
      artefactId: string;
    }
  | { kind: "course_published"; courseId: string; lmsCourseId: string }
  | { kind: "demand_registered"; courseId: string; field: Field } // per-course interest (site seam)
  | { kind: "batch_filled"; courseId: string; batchId: string };
```

- The BI line consumes this event stream. BI is **never** on the critical path — if the sink is down, generation and delivery still work. Note `demand_registered` is where the per-course interest capture from the site feeds demand analytics.

---

## 5. Invariants (non-negotiable — the anti-coupling rules)

1. **The UI reaches the engine only through Seam 1.** No engine logic imported into UI components. _(This is the exact fix for the current CMS.)_
2. **The engine, cache, RAG infra, and LLM keys are server-side only.** Browser holds no keys, touches no cache.
3. **Generated content never lands directly in course rows, and Phase 2 is gated on approval.** Content flows through the status ladder `generating → draft → validated → published`; states are never skipped. **`generateArtefacts` (Phase 2, the detailed course) is forbidden unless `course.status === 'validated'`** — the practitioner must approve the curriculum first (see Appendix B.1).
4. **SOURCE (cache) and BUILD (course) are separate stores; the cache is read-mostly.** A course references source units; it never mutates them. At MVP there is **no live write-back** of practitioner-edited curricula into substrates — `KnowledgeWriter` is a curation/authoring path only (see Appendix B.2). The flywheel door is left open but deferred.
5. **Every bought component sits behind its adapter/interface** (LLM provider, RAG infra, LMS). Swapping any of them touches neither the UI nor the engine core.
6. **Contracts are versioned and evolve additively.** Add fields; don't repurpose or remove them. Bump `Contract version` on change. The version tracks seam-signature changes only; additive config/env changes are recorded in the changelog without a bump.
7. **The app links out to the LMS; it never becomes the LMS.** No auth/payments/enrolment/student-DB built on the owned lines — that's the drift signal; stop.

---

## 6. Assembly-line assignment

| Line                                  | Builds                                                                                                      | Fulfils / builds against         |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------- |
| **Bolt** (React + Supabase)           | Authoring CMS UI shell                                                                                      | consumes Seam 1 (mocked), Seam 4 |
| **Your line** (Claude Code + backend) | Engine (orchestrator, style conditioner, artefact generator), cache orchestration, LMS adapter, BI consumer | fulfils Seams 1, 2, 3, 5, 6      |
| **Bought**                            | LLM (Claude API), RAG infra, App DB, LMS                                                                    | sits behind Seams 2, 3, 4, 5     |

Each line's prompt cites this file and builds **only** its column. That is what makes them assembly lines rather than a pile of parts.

---

## 7. Mock-now → real-later (definition of done = a swap)

| Seam          | Mock now                                          | Real later — the swap             |
| ------------- | ------------------------------------------------- | --------------------------------- |
| 1 — Engine    | Stub returning fixed drafts behind `CourseEngine` | Real orchestrator; same interface |
| 2 — LLM       | Canned strings behind `LlmProvider`               | Claude API call                   |
| 3 — RAG/cache | In-memory list behind retriever/writer            | pgvector/Orq.ai + real cache      |
| 4 — DB        | Supabase tables, source/build split, RLS          | (already real)                    |
| 5 — LMS       | `publishCourse` logs + returns fake id            | Frappe/Moodle adapter             |
| 6 — BI        | `emit` to console                                 | Event sink → BI backend           |

When each mock is replaced by its real implementation **behind the same interface**, nothing else changes. That is the definition of done for the scaffold: everything above is a value swap.

---

## 8. Open items (to lock before the engine line starts)

1. **Storage of artefact content** — `contentRef` target (Supabase Storage vs table vs object store).
2. **Cache granularity** — is a `KnowledgeUnit` per-domain, per-course, or per-lesson? (Affects reuse rate.)
3. **How `qualitySignals` weight retrieval** — the exact flywheel feedback rule.
4. **Auth model shared across the CMS, the public site, and the engine API** — one Supabase project or separate.
5. **Where the BI event sink lives** — same DB, a queue, or a third-party analytics store.

---

## Appendix A — Reusing CareerAsana (shared pattern, different scope)

CareerAsana and this engine share a spine: **AI inference + an accreting cache that is the moat, not the inference.** But the caches differ in kind, and that difference decides what may be reused.

**The fault line, in one test:**

> If a design element or a piece of code assumes **"one person, tracked over time"**, it is CareerAsana's (a personal, longitudinal _Twin_) and does **not** belong here. If it assumes **"many contributors, pooled by domain"**, it fits Academy (a shared, cumulative, reusable _library_). Apply this test to every candidate for reuse.

### A.1 Concept transfer

| Transfer                                  | What                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Copy as-is (principles)**               | Moat-is-data-not-inference; the build-axis discipline (spend effort only where a frontier model can't replicate — generic generation is table-stakes); provenance tracking (here it _is_ the brand, so make it load-bearing).                                                                                                                                                                                                                                                                                                              |
| **Copy partially (machinery, re-scoped)** | Cache infrastructure (vector store, retrieval, write-back, quality-signal weighting) — take the pipes, **re-cut the keys** from person-scoped to domain-scoped. Proactivity — keep the reflex, repoint it from "watch an individual" to demand-sensing (CareerDiya) and domain-drift.                                                                                                                                                                                                                                                      |
| **Does NOT fit (traps)**                  | The **Twin** (per-user longitudinal model — wrong asset, and the LMS/appliance trap of Invariant 7); **engagement-driven flywheel metrics** (Academy's fuel is domain coverage × reuse, not per-user retention); the **B2C freemium pricing model** (Academy is marketplace take-rate — the AI-user and the payer are different people); **external market-data ingestion** (Academy captures its _own_ output, it doesn't ingest the world); **personalization-first design** (the cache only compounds if it's impersonal and reusable). |

### A.2 Code-reuse policy

**Default posture: copy.** CareerAsana's implementation is honed and battle-tested; rewriting clean infrastructure from scratch is waste. Reuse it, **renamed appropriately**, wherever it's safe — the benefit is real even when small.

**The one caution — honed ≠ portable.** Quality and portability are different properties. A beautifully-implemented _person-scoped_ cache is beautifully _wrong_ here, and its very cleanliness makes the mis-scoped assumption _more_ invisible, because the code looks trustworthy. So:

- **Below the scoping line → copy verbatim (then rename).** Anything that carries no "one person over time" assumption: the LLM provider wrapper (Seam 2), vector-store/embedding/retrieval _mechanics_ and chunking (Seam 3 plumbing), auth + RLS patterns (Seam 4), event/telemetry emit (Seam 6), and all cross-cutting scaffolding — API clients, retry/backoff, error handling, logging, prompt-execution harness, test fixtures. This is where the honed quality lives and there is zero domain risk. Copy freely.
- **Above the scoping line → copy the shape, re-derive the logic.** Anything that encodes scope or the flywheel: cache **keying/scoping**, retrieval-query construction (person → domain/field), `qualitySignals` weighting, the Twin data model, any personalization or pricing gate. Keep the structure as a reference; rewrite the logic against Academy's contract.

**Renaming is load-bearing, not cosmetic.** Rename on copy — and specifically purge person-centric names (`twin`, `profile`, `userState`, `person…`). If those names survive the copy, they quietly pull the design back toward the personal model. The name is a scoping assumption in disguise.

**Litmus before any verbatim copy:** run the A.1 test on the file. Passes ("many contributors, pooled by domain" or scope-neutral) → copy and rename. Fails ("one person over time") → shape only. When unsure, treat it as above the line.

---

## Appendix B — Generation & cache model (v0.3)

The v0.3 decisions, captured coherently. These refine _how_ the engine generates and _how_ the cache behaves; they change no seam signatures.

### B.1 Two-phase generation, gated on approval (enforced)

Generation is **two distinct, separately-costed operations with a human gate between them:**

1. **Phase 1 — curriculum draft** (structure, module/lesson titles, objectives). Lighter generation.
2. **Human gate** — the practitioner iterates via `refineCurriculum` (add / remove / update / regenerate,
   permitted only while `status === 'draft'`) then calls **`approveCurriculum(courseId)`** (v0.4, ADR
   0009). On approval, status moves `draft → validated`.
3. **Phase 2 — detailed course** (artefacts per lesson, style-conditioned). Heavy, high-token generation.

**Invariant:** `generateArtefacts` (Phase 2) is **forbidden unless `course.status === 'validated'`.** The status ladder is enforced, not conventional. _Rationale:_ this puts the expensive work behind human approval — cost control and quality control in one gate. You never pay the big generation for a curriculum the practitioner was going to reshape.

### B.2 The cache is read-mostly / curated (write-back deferred)

- Substrates (domain × level curriculum spines) are **authored and curated**, not learned from live practitioner edits. **No automatic write-back** of approved-edited curricula into substrates at MVP.
- _Rationale:_ a single bad approved edit would degrade a substrate that hundreds of future practitioners draw from, and there is no automatic way to tell a good edit from a lazy one at ingest. Curation keeps the floor high and the blast radius zero.
- Substrate quality comes from the **generation prompt: a "pro L&D manager" baseline** that reliably produces a good-for-most curriculum — one only a genuinely experienced trainer would improve on.
- `KnowledgeWriter` is therefore a **curation/authoring path** (you populate substrates), not a live practitioner-driven write. The cache is read-mostly in normal operation.
- **Door left open (out of scope now):** later, measure use-as-is vs. edited rates; if edits with positive downstream signal emerge, introduce a **governed** write-back that ingests only vetted, positively-received curricula. _Earn_ the write-back with data; don't assume it.

### B.3 Pre-loaded substrates (initial cost)

- Pre-load **~5–6 substrates** — one per field at the most likely entry level (≈ medium/working) — stretching to **~8–10** only to warm the two most-likely-first fields at a second level. **Not** the full field × level grid; **not** a flat 25 (that was CareerAsana's per-person unit; ours is domain × level).
- Pre-load cost is a **rounding error** (a spine is a few thousand output tokens; 5–10 spines ≈ a few dollars, once). The real cost is **Phase 2 per approved course**, which only fires _after_ commitment + approval — exactly where you want it. The approval gate (B.1) is what stops you paying the big number speculatively.

### B.4 Router → domain-specialized config dispatch (planned; after M1)

- **Experience:** "give it anything, it generates a course." **Internally:** a router classifies (domain, sub-domain, entry level, material type) and dispatches.
- **Decision:** dispatch to domain-specialized **prompt/config bundles** (system prompt + substrate + artefact templates per domain) — **not** to separate fine-tuned models. One general model, many expert _configurations_. _Rationale:_ per-domain models are a training/ops appliance trap and fragment the multi-field thesis; one strong general model, well-prompted, covers every field. Adding a field = adding a config bundle, not training a model.
- The router is a **dispatch function behind Seam 1 — no new seam.** It composes with the (deferred) tier gate: router picks the config, tier would pick the model size.
- **Sequencing:** _not in M1._ M1 proves one **general** prompt generates credible, field-agnostic curricula. Only after M1's cross-field results show where the general path is weak do we add the router to specialize **only the fields that need it.** Building it in M1 would hide the signal of whether the general engine is already good enough.

### B.5 Model tier — Haiku deferred (supersedes the M1a plan)

- The earlier M1a plan (light/standard tiers, Haiku/Sonnet) is **superseded.** Nearly all engine tasks (curriculum, artefacts) are medium-to-high complexity, so there is no cheap-task category worth splitting yet.
- **Decision:** a **single standard (Sonnet-class) model** for now; the tier gate is **deferred, not built.** _Trigger to revisit:_ a genuinely mechanical, high-volume task category (e.g. bulk metadata tagging, title/summary reformatting) where a cheaper model won't hurt quality.
- **Quality gate first, cost gate second.** Never down-tier curriculum or artefact generation to save pennies — that guts the moat.

---

## Changelog

- **v0.5** — Seam-signature change: `CourseEngine.generateArtefacts` (Seam 1) gained an optional
  fourth parameter, `opts?: GenerateArtefactsOpts` with `lessonIds?: string[]`, so a caller can
  regenerate artefacts for specific lessons instead of the whole course every time — see ADR 0014.
  Backward compatible (omitted ⇒ prior whole-course behaviour, unchanged). Both `MockCourseEngine`
  and `LiveCourseEngine` honour the scope. Also: this file now carries a canonical-source rule
  directly under the version header (ADR 0016, no version impact of its own) — `docs/integration-
contract.md` in the repo is the only living copy; any copy elsewhere is a dated snapshot.
- **v0.4** — Seam-signature change: `CourseEngine` (Seam 1) gained `approveCurriculum(courseId: string):
Promise<Course>`, the human-gate half of the two-phase generation invariant — see ADR 0009 and Appendix
  B.1. `refineCurriculum` is now implemented for all four `Edit` ops (`add`/`remove`/`update` structural
  via the domain layer; `regenerate` via `LlmProvider` + the versioned `prompts/refine.v1.ts` asset) and
  is permitted only on a `draft` course. Draft persistence across the generate → refine → approve →
  generateArtefacts call sequence is backed by a process-level in-memory course store (the Seam-4 mock;
  see `src/modules/engine/infrastructure/courseStore.ts`) — real Supabase replaces it later behind the
  same shape. No other seam signature changed.
- **v0.3** — Config/env change (no bump): `EngineConfig` (`src/contracts/config.ts`) gained `anthropicModel: string`, resolved in `src/shared/config.ts` from `ANTHROPIC_MODEL` (default `claude-sonnet-5`). No seam signature changed; see ADR 0008. Milestone: live Phase-1 curriculum generation (Seam 1 `LiveCourseEngine` + Seam 2 `AnthropicLlmProvider`).

---

_This contract is the boundary map. It is decided at the level of seams and invariants; §8 lists the values still to set. Build every assembly line against it; when a component becomes real, it slots in behind its seam without touching the others. When a seam genuinely must change, bump the contract version and update the affected lines — never let a line quietly couple across a seam to save time. That shortcut is the one thing this document exists to prevent._
