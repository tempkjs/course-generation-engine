# ADR 0008 — Model id resolved via shared config, not hard-coded

**Status:** Accepted (contract v0.3, no bump — config/env addition)

## Context
Milestone 1 wires a real `AnthropicLlmProvider` (Seam 2). ADR 0007 fixes a single
standard (Sonnet-class) model with no tier param. The provider must not hard-code that
model id — it has to come from the same central config resolver (`src/shared/config.ts`)
that already resolves `AI_MODE` and the API key (ADR 0003), so a model swap is a config/env
change, not a code change.

## Decision
Add `anthropicModel: string` to `EngineConfig` (`src/contracts/config.ts`) — an additive
field, not a change to any seam signature or to `Course`/`GenerateRequest`. `getConfig()`
resolves it from `ANTHROPIC_MODEL` with a default of `claude-sonnet-5` (the current
Sonnet-class model per ADR 0007). `AnthropicLlmProvider` reads it from `getConfig()`,
the same way it already reads the API key.

## Consequences
Swapping the standard model (e.g. a future Sonnet release) is an env/default change in one
place, never a provider edit. No tier machinery is introduced — this is one field, not a
router (ADR 0006 stays out of scope).
