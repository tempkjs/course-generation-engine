# Engineering Handbook

The conventions for course-creation-engine. Adapted from the CareerAsana engineering
standard (the reference codebase). These are the rules; `CLAUDE.md` is the summary.

## Stack
- **Next.js + TypeScript** (modular monolith), **Supabase** (Postgres + Auth + RLS),
  **pnpm**. LLM via **Anthropic** (default) behind a provider interface.
- The Next.js `app/` here is a **disposable verification harness only** — see §7.

## 1. Modular monolith
- Code lives in `src/modules/<module>`. Each module has up to four layers:
  - `domain/` — pure logic, no I/O, no framework. Fully unit-testable.
  - `application/` — orchestration/use-cases; composes domain + other modules' public APIs.
  - `infrastructure/` — adapters to the outside world (LLM, DB, cache, LMS). Mocks live here too.
  - `ui/` — only if the module exposes a client/component (e.g. the engine client).
- **Public API is `index.ts` only.** Everything a module exposes is re-exported there.
  Nothing outside the module may import a deeper path. This boundary is CI-enforced
  (`no-restricted-imports`), because a boundary that isn't a gate isn't a boundary.

## 2. Contract-first
- Shared types and seam interfaces live in `src/contracts` and are the single source of
  truth. Modules build to them; they never redefine them. Treat `src/contracts` like a
  frozen API — change it deliberately (version bump + ADR), never casually.

## 3. The Two Freezes (from CareerAsana)
- **Contract freeze:** `src/contracts` + the six seams change only via an ADR that bumps
  the integration-contract version. This is the stable spine.
- **Design layer:** everything behind a seam (how the orchestrator prompts, how the cache
  ranks, how a mock behaves) iterates freely without ceremony. Move fast here.

## 4. AI_MODE — mock/live cost & determinism control
- `AI_MODE=mock` (default): no external calls. Every seam resolves to its mock. Output is
  deterministic. **All tests run here.** Costs nothing.
- `AI_MODE=live`: real providers (Anthropic, pgvector, etc.). Opt-in, never required to
  build or test. Resolved centrally in `src/shared/config.ts`; modules ask config, not env.

## 5. TypeScript strictness
- `strict: true`, plus `noUncheckedIndexedAccess` and `noImplicitOverride`. No `any` at
  module boundaries. Prefer explicit return types on public functions.

## 6. Prompt governance
- Prompts are versioned assets, **never edited in place** once published. A new behaviour
  is a new prompt version. (Prompts land under `modules/engine` when the real engine ships.)

## 7. The disposable UI harness (`src/app`)
- Exists **only** to verify engine features by hand. It is intentionally minimal and
  unstyled. It imports **only** the engine's public client (`modules/engine` → `CourseEngineClient`)
  and `src/contracts`. It must never reach into engine internals.
- **Plug-and-play rule:** the real Swakojo Academy website will import the *same*
  `CourseEngineClient` against the deployed engine. So the harness is a second consumer of
  the exact seam the website uses — if the harness needs an internal import to work, the
  seam is wrong, not the harness.

## 8. Commits, PRs, ADRs
- Conventional commits, module-scoped: `feat(engine):`, `fix(knowledge):`, `docs:`, `chore:`.
- One seam per PR where possible. CI must be green (typecheck, lint, boundaries, mock tests, format).
- ADRs (`docs/adr/NNNN-title.md`) for real decisions only. Log rough edges in `STANDING_GOTCHAS.md`.
