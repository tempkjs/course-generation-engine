# ADR 0012 — Bounded retry with backoff for transient LLM errors (Seam 2)

**Status:** Accepted (contract v0.4, no bump — Seam 2 signature unchanged)

## Context

The M3 CA/GST live validation run (`tests/live.ca-gst.test.ts`) failed after ~12 minutes and
~48 sequential Anthropic calls when the API returned a transient `529 Overloaded` error.
`AnthropicLlmProvider.generate()` constructed its client with no `maxRetries` override, so it
ran on the Anthropic SDK's implicit default of 2 retries (3 total attempts) — an accident of
the library default, not a deliberate policy, and not enough headroom to ride out a sustained
overload window. A single transient error aborted an entire multi-call pipeline (curriculum →
refine → Phase-2 artefact generation), discarding every already-completed call's cost.

## Decision

Configure the Anthropic SDK's **built-in** retry mechanism explicitly, rather than writing a
custom wrapper:

```ts
const MAX_RETRIES = 3; // 3 retries => 4 total attempts
const client = new Anthropic({
  apiKey: anthropicApiKey,
  maxRetries: MAX_RETRIES,
});
```

The SDK's `shouldRetry` policy (verified by reading `@anthropic-ai/sdk@0.115.0`'s
`client.ts` — it is not itself configurable, only the attempt count is) already does exactly
what we need:

- **Retries:** HTTP 408 (timeout), 409 (lock), 429 (rate limit), and any `>= 500` — Anthropic's
  `529 overloaded_error` (the exact error the live run hit) is covered without special-casing.
- **Never retries:** any other 4xx (400 bad request, 401/403 auth, 404, ...) — retrying a
  malformed or unauthorized request can't succeed, so these surface on the first attempt.
- **Backoff:** exponential (0.5s base, doubling, capped at 8s per attempt) with up to 25%
  jitter (`calculateDefaultRetryTimeoutMillis`). Worst case across 3 retries adds roughly
  7.5s, not an unbounded wait.
- **After the cap:** throws the original `APIError` unchanged — a caller sees the same error
  shape whether the call failed on attempt 1 or attempt 4.

Our own post-response refusal check (`response.stop_reason === 'refusal'`) is unaffected: it
only runs on an already-successful (2xx) response, a layer above where `shouldRetry`
operates — a safety-classifier refusal is never mistaken for a transient failure and never
retried (retrying wouldn't change the model's decision anyway).

**Why configure the SDK instead of writing a wrapper:** the integration contract's Appendix A
(CareerAsana reuse policy) already classifies "the LLM provider wrapper (Seam 2)... retry/
backoff" as _below the scoping line_ — honed, domain-neutral infrastructure, safe and
preferable to reuse rather than reinvent. The SDK's built-in policy already matches every
requirement (bounded attempts, exponential backoff + jitter, transient-only, throws the
original error after the cap); writing a bespoke wrapper around already-correct vendor logic
would be pure risk for no behavioral benefit.

## Consequences

- No contract/seam change — `LlmProvider.generate()`'s signature is untouched; this is an
  internal robustness change to one implementation (`AnthropicLlmProvider`) behind Seam 2.
- A sustained overload longer than ~4 attempts' worth of backoff still fails the call (and,
  transitively, whatever multi-call pipeline was mid-flight). Retries raise the odds of
  riding out a _transient_ blip; they don't make the system immune to a real outage. If that
  proves to be an operational problem in practice, the next lever is application-level
  (checkpointing partial pipeline progress), not more retries.
- Tested in `tests/llm.retry.test.ts` via a stubbed `fetch` (deterministic, no real network —
  `AnthropicLlmProvider` builds a fresh `Anthropic` client per call, and the SDK resolves
  `fetch` from `globalThis` at that point, so stubbing the global is sufficient without any
  dependency-injection changes to the provider itself). Required exporting
  `AnthropicLlmProvider` from `@/modules/llm`'s public index (previously reachable only
  indirectly via `getLlmProvider()`), so the test can construct and call it directly — a
  module-surface addition only, matching the precedent ADR 0010/0011 already set for the
  engine module's barrels; `getLlmProvider()`'s `AI_MODE` dispatch is unaffected.

## Related finding (not fixed here — flagged for the architect)

The same live run also showed `generateArtefacts` has no lesson-scoping: requesting
artefacts for a course fans out to **every** lesson (24 lessons × 2 types = 48 calls for that
run), not just the one lesson a caller may care about. Retry/backoff makes each of those 48
calls more resilient, but doesn't change the fact that there are 48 of them, or their cost.
Worked around test-side for the narrowed CA/GST live check (trimming a course down to one
module/one lesson via existing `refineCurriculum` `remove` edits, before approving and
generating artefacts — no contract change). A real `lessonId`-scoped `generateArtefacts`
variant would be a genuine Seam 1 change and is not decided unilaterally here.
