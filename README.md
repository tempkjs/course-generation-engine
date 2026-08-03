# course-creation-engine

The AI course-authoring engine for **Swakojo Academy** — the owned core of practitioner
engagement. It turns a practitioner's intent into a course (curriculum generation,
teaching-style-conditioned artefacts) and grows a compounding **domain knowledge cache**
(the moat). The learner-facing UI lives in the **Swakojo Academy website**, not here; the
`src/app` harness is a disposable tool for verifying features against the real seam.

## Read first
- **`CLAUDE.md`** — how the AI team works; the invariants. Every session reads this first.
- **`docs/integration-contract.md`** — the boundary map (six seams, data contracts, the
  CareerAsana reuse policy in Appendix A). This is the architect.
- **`docs/ENGINEERING_HANDBOOK.md`** / **`docs/CONTRIBUTING.md`** — conventions & workflow.

## Quick start
```bash
pnpm install
cp .env.example .env.local     # AI_MODE=mock — no keys, no network
pnpm typecheck && pnpm test    # mock-mode tests
pnpm dev                       # harness at http://localhost:3000/harness
```

## Shape
```
src/contracts/        the jig — shared types + the six seam interfaces (import via @/contracts)
src/modules/
  engine/             owned core: domain · application (orchestrator) · infra (mock) · ui (client)
  llm/                Seam 2 — LlmProvider (mock + Anthropic stub)
  knowledge/          Seam 3 — the cache (moat), domain-scoped, mock in-memory
  lms/                Seam 5 — LmsAdapter (mock)
  events/             Seam 6 — EventSink (console)
src/shared/           AI_MODE/config resolver + server-only guard + db client factory
src/app/              DISPOSABLE Next.js verification harness (not production UI)
```

## Rules that matter most
1. UIs import **only** `@/modules/engine` (the `CourseEngineClient`) — never engine internals.
   The real website imports that same client. Plug-and-play.
2. Modules import each other **only** through `index.ts` (CI-enforced).
3. `AI_MODE=mock` is the default and the test mode — deterministic, no network, no cost.
4. The cache is **domain-scoped, never person-scoped** (that's CareerAsana's Twin — see Appendix A).
5. This is **not** an LMS. No auth/payments/enrolment/student-DB here.

> Not yet built/installed in this environment (no network). First local step: `pnpm install`.
> Expect 1–2 iterations to green — the structure and contracts are the deliverable.
