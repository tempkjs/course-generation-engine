# Standing gotchas (running log)

A short, append-only log of non-obvious traps. Add to it whenever something surprises you.

- **YouTube "Private" can't be embedded; "Unlisted" can** — relevant only when the real
  video socket lands in the LMS layer, not here. Noted so it isn't rediscovered.
- **Honed ≠ portable (CareerAsana reuse):** clean code makes a mis-scoped assumption
  *more* invisible. Run the Appendix-A litmus before any verbatim copy.
- **AI_MODE leakage:** if a test needs a network call, it's testing the wrong layer —
  the seam's mock is missing or being bypassed. Fix the mock, don't loosen the test.
- **Source vs Build:** a `Course` references `KnowledgeUnit`s; it must never mutate them.
  Writing generated content straight into a course row skips the validation states.
- **Harness client-component calls in-process engine:** fine in `AI_MODE=mock` (the mock
  never touches the cache, so `assertServerOnly` isn't hit). Before wiring `live`, swap the
  harness to call the engine via an API route / HTTP `CourseEngineClient` so server-only
  code never enters the browser bundle. The client interface stays identical (that's the point).
  **Resolved (milestone 1) — and it had to be ALL four methods, not just generateCurriculum:**
  a first pass left `refineCurriculum`/`generateArtefacts`/`commitToCache` calling
  `getCourseEngine()` in-process "since they don't touch secrets." That was wrong — merely
  *importing* `../application/orchestrator` from `client.ts` pulls in `LiveCourseEngine` ->
  `AnthropicLlmProvider` -> the Anthropic SDK -> `node:fs`/`node:path` for the **whole static
  import graph**, and `pnpm build` failed on `UnhandledSchemeError` even though no live code
  ever ran. Webpack bundles what's *imported*, not what's *reached at runtime*. Fix:
  `CourseEngineClient` now has zero imports from engine internals — all four methods are
  thin `fetch()` wrappers over server-only `/api/*` route handlers
  (`generate-curriculum`, `refine-curriculum`, `generate-artefacts`, `commit-to-cache`),
  each calling `getCourseEngine()` only inside the route handler (never bundled client-side).
