# CLAUDE.md — read this first, every session

You are the development team for **course-creation-engine**, the AI course-authoring
brain of Swakojo Academy. The human is the **architect-of-record**: they own the
decisions and the contract. You **write code to the contract**; you do **not** change
the contract to fit the code. When the contract seems wrong, stop and say so — do not
route around it.

## What this engine is (and is not)

- **Is:** the owned core that turns a practitioner's intent into a course — curriculum
  generation, teaching-style-conditioned artefacts, and a compounding **domain knowledge
  cache** (the moat). Consumed by an **external** UI (the Swakojo Academy website).
- **Is not:** an LMS. No auth-for-learners, payments, enrolment, student database, or
  video hosting live here. Those are bought (Frappe/Moodle) and linked, never built.
  If you find yourself building one, **stop** — that is the drift signal.

## The six seams (see docs/integration-contract.md — the boundary map)

Everything crosses a named seam. Never couple across one.

1. UI ↔ Engine — `CourseEngine` (contracts/engine.ts). The website imports this. **Never**
   import engine internals into a UI; go through `modules/engine` public `index.ts`.
2. Engine ↔ LLM — `LlmProvider`. Provider swappable. Keys **server-side only**.
3. Engine ↔ Knowledge/RAG — `KnowledgeRetriever`/`KnowledgeWriter`. Cache is the moat,
   **server-side only**, **domain-scoped** (never person-scoped — see reuse policy).
4. App ↔ DB — Supabase. **SOURCE (cache) and BUILD (course) tables are separate.**
5. App ↔ LMS — `LmsAdapter`. Link out; never become the LMS.
6. Everything ↔ BI — `EventSink`. Fire-and-forget; never on the critical path.

## Hard invariants (CI-enforced; do not violate to save time)

- **Public-import-only:** modules import each other **only** through their `index.ts`.
  Deep imports (`modules/x/infrastructure/...`) from outside that module are forbidden.
- **Server-side boundary:** the browser holds **no** API keys and touches **no** cache.
- **Two-phase gate (enforced):** content flows `generating → draft → validated → published`;
  states are never skipped. `generateArtefacts` (Phase 2 / detailed course) is FORBIDDEN unless
  `course.status === 'validated'` — the practitioner approves the curriculum first (ADR 0004).
- **Cache is read-mostly:** substrates are curated, not learned from live edits. `KnowledgeWriter`
  is an authoring/curation path; no live write-back at MVP (ADR 0005). Cache stays domain-scoped.
- **AI_MODE:** all tests run in `AI_MODE=mock` (no external calls, deterministic). `live`
  is opt-in and never required to build or test.
- **Contract-first:** shared types live in `src/contracts`. Do not redefine them per module.

## CareerAsana reuse (see integration-contract Appendix A)

Default posture: **copy honed CareerAsana code and rename** — but only **below the
scoping line** (LLM wrapper, vector/embedding mechanics, auth/RLS, telemetry, scaffolding).
**Above the scoping line** (cache keying, retrieval query, flywheel, any personalization)
copy the _shape_, re-derive the logic. Purge person-centric names (`twin`, `profile`,
`person…`) on copy — a surviving name is a scoping assumption in disguise. Litmus: if it
assumes "one person over time" it does not belong here; if "many contributors pooled by
domain" it does.

## How to work

- Read `docs/ENGINEERING_HANDBOOK.md` (conventions) and `docs/CONTRIBUTING.md` (workflow)
  before writing code. Log surprises in `docs/STANDING_GOTCHAS.md`.
- Real decisions get an ADR in `docs/adr/`. Small stuff does not.
- Conventional commits, scoped by module: `feat(engine): ...`, `fix(knowledge): ...`.
- Keep changes inside one seam per PR where possible. If a change forces a contract edit,
  raise it as a contract-version bump + ADR, not a silent edit.
