# Contributing / Workflow

## Setup
```bash
pnpm install
cp .env.example .env.local      # AI_MODE defaults to mock; no keys needed to start
pnpm typecheck && pnpm test     # runs in AI_MODE=mock
pnpm dev                        # the disposable verification harness at /harness
```

## Definition of done (per change)
- [ ] Stays inside one seam; no cross-seam coupling; no deep imports across modules.
- [ ] Types come from `src/contracts`; nothing redefined locally.
- [ ] Tests pass in `AI_MODE=mock` (deterministic, no external calls).
- [ ] `pnpm lint` (incl. import-boundary rule) and `pnpm format:check` are green.
- [ ] Server-only code (engine, keys, cache) never imported into `src/app` (browser).
- [ ] If a contract had to change: version bump + ADR, not a silent edit.

## Branch & commit
- Branch: `feat/<module>-<slug>`. Commits: conventional, module-scoped.
- PR description states which seam(s) it touches and confirms the DoD checklist.

## When the spec is wrong
You are the team, not the architect. If the contract blocks correct work, **stop and
flag it** with a proposed contract change + rationale. Do not couple across a seam to
make progress — that is the one shortcut this repo exists to prevent.
