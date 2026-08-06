# ADR 0017 — Fixtures-first; live only when behaviour changes

**Status:** Accepted. Implemented now.

## Context

Two live runs so far (CA/GST, and this packet's Employee Relations capture) each cost real
Anthropic credits and several minutes of wall-clock. Most of the bugs found afterward,
though, were never in what the model produced — they were in code sitting downstream of it:
a parser that didn't unwrap the response envelope correctly, a UI panel that rendered the
wrong field, a checklist that mis-aggregated. None of that needed a live call to catch or to
fix; it needed the **exact bytes the model already returned**, replayed deterministically.
Spending credits to re-validate the same downstream code path over and over — when the
model's output isn't what changed — is waste with no safety benefit, and it quietly trains
the habit of reaching for a live run by default instead of asking first whether the model's
output is actually what's in question.

The inverse failure is just as real: a fixture is a frozen snapshot of one prompt version's
output. Testing new prompt logic against an old fixture doesn't validate the new behaviour —
it validates that the mock replays the old behaviour, which was never in doubt. A change that
alters what the model produces (a new jurisdiction anchor, a reworded instruction, a new
claim-flagging rule) can only be judged by asking the model again.

## Decision

**Live API credits are spent ONLY when validating the MODEL'S OUTPUT itself. Everything else
uses fixtures.**

1. **Capture.** A live output (`validation-output/*.log`, per ADR 0015) may be copied into
   `fixtures/` and replayed as a deterministic mock. Name each fixture for the **prompt
   version** it came from, e.g. `fixtures/artefacts.v2/employee-relations.json` — the fixture
   is a snapshot of that version's behaviour, not of the topic or the date.
2. **Downstream changes → fixtures only, no live call.** Parsing, unwrapping, rendering, UI,
   storage, flag display, checklist aggregation — anything that consumes an already-generated
   response — is validated by replaying a captured fixture through the changed code. The
   model's output isn't in question, so there is nothing a live call would tell you that the
   fixture doesn't already show.
3. **Upstream changes → ONE fresh live run required.** Prompt text, generation behaviour,
   jurisdiction/locale grounding, style conditioning — anything that alters WHAT the model
   produces — cannot be validated by a fixture, because a fixture only replays stale output;
   testing new prompt logic against it would silently hide the very change being tested. Run
   once live, inspect the real output, then promote it to the fixture for that prompt
   version's future downstream tests.
4. **Staleness.** A fixture is a dated snapshot of a prompt version, not of the underlying
   code. When that prompt version bumps (`artefacts.v2` → `artefacts.v3`, e.g.), every fixture
   named for the old version is stale — regenerate them under the new version rather than
   testing new-prompt code against old-prompt fixtures, which proves nothing about the new
   prompt.

## Consequences

- No contract change. Purely a testing/process rule.
- `fixtures/<prompt-version>/*.json` joins `validation-output/` (ADR 0015) as the second half
  of the live-run pipeline: capture once, replay forever until the prompt version moves.
- Forces a deliberate question before every live run: "does this change what the model
  produces, or just what happens to its output afterward?" — the answer decides whether
  credits are spent at all.
- A prompt-version bump is now also implicitly a "go regenerate these fixtures" signal, not
  just a governance formality (ENGINEERING_HANDBOOK.md §6).

## Build note

First applied in this same packet: the JSON-envelope-leak fix (`domain/artefacts.ts`'s
`parseArtefactResponse` + the `/studio` content panel) is a downstream change, validated
against `fixtures/artefacts.v2/employee-relations.json` — a real capture, zero live calls
spent on the fix itself. Adding `jurisdiction` (contract v0.7, ADR 0018) is an upstream
change — it changes the curriculum and artefact prompts — so it required the one live run
that produced that fixture in the first place, then a second live run (post-jurisdiction) to
validate the India-grounded prompt versions and promote their own fixtures.

## Addendum — mock-mode enforcement doesn't depend on running the right command

A raw `npx vitest run` (no `AI_MODE=mock` prefix) picked up `.env.local`'s `AI_MODE=live` —
present there so `pnpm test:live` doesn't require exporting the key by hand — and ran the
"mock" test files against the real Anthropic API. Minutes and real credits were spent
re-validating downstream code this ADR says shouldn't need a live call at all, and the
fumble was a command-line slip, not a decision anyone made.

**The fix has to hold regardless of the command used to invoke it.** `tests/support/
forceMockMode.ts` sets `process.env.AI_MODE = "mock"` and eagerly resolves `getConfig()` at
import time, before any test body runs; every `*.mock.test.ts` file imports it first. Because
`getConfig()` memoizes per test file (vitest isolates the module registry per file), that
early call locks the file's resolved mode to `mock` — a later `AI_MODE=live` in the
environment, however it gets there, cannot un-cache it. `tests/mockMode.enforcement.test.ts`
proves this directly: it sets `process.env.AI_MODE = "live"` mid-test and asserts
`getConfig().aiMode` is still `"mock"`.

Same enforcement spirit as the rest of this ADR: the safety net for "did this waste live
credits" should not rely on a human remembering to type the right prefix.
