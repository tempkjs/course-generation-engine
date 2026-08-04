# ADR 0010 — Engine module exposes two public barrels

**Status:** Accepted (contract v0.4, no bump — internal module surface, not a seam signature)

## Context

Milestone 1 established the module-boundary rule: "modules import each other only through
their `index.ts`" (CLAUDE.md, ENGINEERING_HANDBOOK.md §1) — one door in. Milestone 1 also
already split the engine module's public surface into two files, `index.ts` and `server.ts`
(see the `STANDING_GOTCHAS.md` entry on the harness/client split), but that split was never
written up as a decision — it just happened as a bug fix, documented only as a gotcha.

Milestone 2 made the split load-bearing in a second way: the new `/api/approve-curriculum`
route and `tests/refine.mock.test.ts` / `tests/live.refine.test.ts` all import
`getCourseEngine` from `@/modules/engine/server`, alongside the pre-existing UI import of
`CourseEngineClient` from `@/modules/engine`. Two consumer classes, two barrels, on purpose.
That's a real change to the module's public surface — "one door" became "two doors, each for
a different consumer" — and it deserves a recorded decision, not just a gotchas-log entry
that explains the bug it fixed.

**Why two barrels, concretely:**

- `@/modules/engine` (`index.ts`) is the **browser-safe surface**. It exports only
  `CourseEngineClient` — a pure HTTP client (`fetch` wrappers over `/api/*` routes) with zero
  imports from engine internals. This is what the UI (the disposable harness today, the real
  Swakojo Academy website later) imports.
- `@/modules/engine/server` (`server.ts`) is the **server-only surface**. It exports
  `getCourseEngine`, which composes `LiveCourseEngine` → `AnthropicLlmProvider` → the
  Anthropic SDK → Node builtins (`node:fs`/`node:path`). This is what `/api/*` route handlers
  and server-side tests (running under Node/Vitest) import.

The split exists because **merely importing** `getCourseEngine` — even if nothing calls it —
pulls the entire `LiveCourseEngine` import graph into whatever bundle imports it, transitively.
Webpack bundles what's _imported_, not what's _reached at runtime_. A single barrel that
re-exported both `CourseEngineClient` and `getCourseEngine` would drag the Anthropic SDK (and
the Node builtins it needs) into the browser bundle the moment any UI code imported anything
from the engine module at all — the exact failure `STANDING_GOTCHAS.md` already documents
(`pnpm build` failing on `UnhandledSchemeError` with no live code ever running).

## Decision

The engine module keeps **two public entry points**, both enforced by the same rule:

- **Browser/UI code imports only `@/modules/engine`.** Never `@/modules/engine/server`.
- **Server code (API routes, server-side tests) imports `@/modules/engine/server`** for
  `getCourseEngine`. It may also import `@/modules/engine` for the shared `CourseEngine`/
  `GenerateRequest`/`Edit` types, since those are re-exported from both barrels.
- Importing the server barrel from a client component (or from any file reachable from one)
  reintroduces the exact bundle-leak `STANDING_GOTCHAS.md` documents — this is the one thing
  this ADR exists to prevent someone from doing "just this once."

This is a module-internal surface decision, not a seam-signature change: `CourseEngine`
(Seam 1) itself is unchanged, and the six seams in the integration contract are unaffected.
**No contract version bump.**

**The ESLint boundary rule already treats both barrels correctly — confirmed, not changed.**
`eslint.config.mjs`'s `no-restricted-imports` patterns are derived from each module's
_subdirectories_ (`domain/`, `application/`, `infrastructure/`, `ui/`, `prompts/`); `index.ts`
and `server.ts` are plain files at the module root, not subdirectories, so neither is matched
by the deep-import restriction — both remain legitimate public entry points as far as the
rule is concerned. **Do not "fix" the boundary rule to allow only one file per module** — that
would forbid the server barrel and break every `/api/*` route handler and server-side test.

## Consequences

- Two import paths for one module is a deliberate exception to "one door," scoped narrowly:
  it exists only because the two consumers (browser vs. server) have genuinely incompatible
  bundling requirements, not because it's convenient to split exports.
- Any future module that needs the same client/server split (unlikely outside the engine,
  given only the engine composes the LLM SDK today) should follow the same pattern and cite
  this ADR, rather than inventing a different shape.
- If a module ever needs a third distinct consumer with its own bundling constraint, that's a
  new ADR, not a silent third barrel.
