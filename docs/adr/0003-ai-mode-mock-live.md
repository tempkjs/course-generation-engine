# ADR 0003 — AI_MODE: mock is the default and the test mode

**Status:** Accepted

## Context

External calls (LLM, vector DB) cost money and are non-deterministic — bad for tests and
for an AI team iterating fast.

## Decision

A central `AI_MODE` switch. `mock` (default) resolves every seam to a deterministic mock
with no network; `live` uses real providers and is opt-in. All tests run in `mock`.
Resolved once in `src/shared/config.ts`; modules ask config, never read env directly.

## Consequences

The whole engine builds, runs, and tests with zero keys and zero cost. `live` is a swap,
not a rebuild — matching the mock-now/real-later table in the integration contract.
