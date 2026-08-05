# ADR 0015 — Live-run observability: token logging + durable validation output

**Status:** Accepted. Implemented now (seals M3). No seam change, no version bump.

## Context

Two process gaps the CA runs exposed:

1. **No token capture.** `AnthropicLlmProvider.generate()` never logs `response.usage`, so
   after the most expensive runs yet we still have no real Phase-2 token cost — the number
   the whole per-approved-course cost model depends on. We have wall-clock and call counts
   only.
2. **Ephemeral, agent-only validation output.** The printed validation content landed in a
   `/tmp` logfile that only the agent read; it then summarised it, and a summary-of-a-summary
   nearly reached the architect as fact (the _Safari Retreats_ citation was described but
   not seen). When the architect is meant to _judge_ generated content, the architect must
   read the **primary output**, not the agent's paraphrase.

## Decision

1. **Token logging.** `AnthropicLlmProvider.generate()` records `response.usage`
   (input/output tokens) per call; live runs aggregate and report per-run totals.
   Server-side, off the critical path. This is the standing source for Phase-2 cost data.
2. **Durable validation output.** Live validation tests write their full printed output to a
   durable, **gitignored** `validation-output/` file in the working tree (e.g.
   `validation-output/<test>-<timestamp>.log`), so "the architect reads the output" means
   the architect opens primary text in the repo, not a `/tmp` path the agent alone saw.

## Consequences

- No contract change. `validation-output/` added to `.gitignore`.
- Every future live run quietly accumulates real token/cost data.
- Closes the trust gap that let a paraphrase stand in for primary content.

## Build note

**Token logging:** a new process-level accumulator, `src/modules/llm/infrastructure/
usageTracker.ts` (`recordUsage`/`getUsageTotals`/`resetUsageTotals`) — same process-level-
singleton shape as `courseStore.ts`/`contentStore.ts` (ADR 0009/0011), scoped to `AnthropicLlmProvider`
only (`MockLlmProvider` makes no real request, so there is nothing real to total). `getUsageTotals`
and `resetUsageTotals` are re-exported from `@/modules/llm`'s public index — a module-surface
addition for live-test consumption, same precedent as ADR 0010/0011/0012; `LlmProvider`'s
contract is unchanged.

**Durable output:** `tests/support/validationLog.ts` (`createValidationLog(testName)`)
writes every logged line to both the console and a timestamped file under
`validation-output/`, and returns the file's path so each test can print it — "the output"
now names a file in the repo, not a transcript. All four live test files
(`live.curriculum`, `live.refine`, `live.artefacts`, `live.ca-gst`) were switched to it,
which also removed the need for their scattered per-call `eslint-disable no-console`
comments (the logger owns the one sanctioned `console.log` call).
