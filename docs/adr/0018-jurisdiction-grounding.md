# ADR 0018 — Jurisdiction grounding (Seam 1 payload change → contract v0.7)

**Status:** Accepted. Implemented now.

## Context

The Employee Relations live run (no jurisdiction field existed yet) generated content
grounded entirely in US law — Title VII, the ADA, the ADEA, the FMLA, the NLRA, EEOC
guidance and remedies — for a practitioner whose actual audience is Indian HR teams. This
wasn't the model picking the wrong jurisdiction; the engine had no jurisdiction concept at
all, so the model fell back to the jurisdiction most represented in its training data for
this domain. The resulting artefact (`fixtures/artefacts.v2/employee-relations.json`) is
fluent, well-structured, and grounded in the wrong country's statutory framework — a failure
mode the practitioner-approval gate (ADR 0005) exists to catch, but shouldn't have to catch
something this systematic and avoidable.

The obvious-looking fix — "generate the US version, then have the model translate it to
India's equivalent" — is rejected here for the same reason ADR 0013's Decision 2 rejected
ghostwriting-as-the-practitioner: it bakes the wrong frame in at generation time, not after.
"India's equivalent of Title VII" is not a real construct — India's employment-discrimination
and labour-relations law is not shaped like a translated Title VII; it is its own body of
statute (the POSH Act, the Industrial Disputes Act, Standing Orders, state Shops &
Establishments Acts, the four Labour Codes) with its own structure, thresholds, and
institutions. A mapping exercise would produce content that is confidently wrong in a new way
— plausible-sounding "equivalents" that don't correspond to how the actual law works.

## Decision

Add an optional `jurisdiction` field, threaded through both generation calls that produce
legal/regulatory-sensitive content:

```ts
interface GenerateRequest {
  // ...
  jurisdiction?: Jurisdiction; // e.g. "IN" — open enum, not a fixed union
}
interface Course {
  // ...
  jurisdiction?: Jurisdiction; // carried forward from GenerateRequest
}
```

**Genuine Seam 1 signature change → contract v0.7.** `Course.jurisdiction` exists so
`generateArtefacts` — a later, separately-costed call, possibly a different HTTP request
entirely (practitioner approves curriculum, comes back later for Phase 2) — has the anchor
without the caller re-supplying it.

**Three behavioural rules, all enforced at the prompt layer (new versions, ADR-0013-style
prompt governance — v1/v2 untouched):**

1. **Native grounding, never translation.** When `jurisdiction` is provided, the prompt
   instructs the model to identify and use that jurisdiction's OWN statutory/regulatory
   framework as the PRIMARY frame — not a mapping or "equivalent" of any other country's law.
   For `"IN"` specifically, the prompt names concrete anchors (POSH Act, Industrial Disputes
   Act, Standing Orders, Shops & Establishments Acts, the Labour Codes) to reduce ambiguity,
   since this is the jurisdiction the motivating failure and the validation run both target.
   Other jurisdiction codes get the general native-grounding instruction without a hardcoded
   anchor list — extending precision to a new jurisdiction is a prompt-layer addition, not a
   new contract field or a router (same "one general model, config bundles" posture as
   Appendix B.4, applied at jurisdiction grain instead of field grain).
2. **Omitted ⇒ neutral, never a silent default.** No `jurisdiction` does NOT mean "assume
   US" — the prompt explicitly instructs the model to keep legal/regulatory content
   jurisdiction-neutral (general principles, flagged as needing jurisdiction-specific
   confirmation) rather than defaulting to whichever country's law is best-represented in
   training data. This is the actual bug being fixed: an absent anchor silently became a US
   default; the fix makes "absent" produce neutral output instead.
3. **Claim-flagging (ADR 0013) still applies on top.** A named jurisdiction's statutes are
   still non-static claims — every named Act, section, or threshold cited under a
   jurisdiction anchor gets flagged (`citation`/`figure`/etc.) exactly as before. Jurisdiction
   grounding changes WHICH law is cited; it does not relax the obligation to flag it.

**Threading:** `GenerateRequest.jurisdiction` → `prompts/curriculum.v2.ts` (Phase 1) and, via
`Course.jurisdiction`, → `prompts/artefacts.v3.ts` (Phase 2). `/studio` seeds `jurisdiction:
"IN"` as its demo default.

## Consequences

- **Contract (v0.7):** `GenerateRequest` and `Course` both gain optional `jurisdiction:
Jurisdiction` (`Jurisdiction = string`, open enum — same shape convention as `Field`).
  Payload change on existing Seam 1 methods, not a new method or a breaking one — omitted
  behaves as before (neutral generation), so existing callers are unaffected.
- **Prompt governance:** `prompts/curriculum.v2.ts` and `prompts/artefacts.v3.ts` are new,
  versioned assets; `curriculum.v1.ts` and `artefacts.v2.ts` are untouched history.
  `engineLive.ts` and `application/generateArtefacts.ts` now import the v2/v3 prompts.
- **Fixture staleness (ADR 0017 rule 4):** `fixtures/artefacts.v2/employee-relations.json`
  (the US-law capture) is stale the moment `artefacts.v3` exists — it's a snapshot of the OLD
  prompt's behaviour, and testing new-prompt code against it would prove nothing about the new
  prompt. Deleted; replaced by `fixtures/artefacts.v3/employee-relations.json`, captured from
  the one live run this ADR requires (jurisdiction-neutral fixture also stale for the same
  file, if/when one existed — Fix 1's fixture was the US-law capture itself).
- **Validation:** one live run (ADR 0017 rule 3 — an upstream/behaviour change, fixtures
  cannot substitute) regenerating Employee Relations with `jurisdiction: "IN"`, confirming the
  content now cites Indian statutes natively and the verification worklist flags Indian
  citations instead of US ones. See `validation-output/` for the captured run.
- **Not built here:** a jurisdiction × field anchor table beyond the one entry (`"IN"`) needed
  now. Extending to more jurisdictions is additive prompt-layer work, not a contract change —
  add anchors as real demand names them, same discipline as Appendix B.3's substrate
  pre-loading (don't build the full grid speculatively).

## Build note — two live runs, one unrelated bug found and fixed en route

Validating this ADR took two live runs, not one, for a reason unrelated to jurisdiction
grounding: the first run truncated BOTH artefact responses mid-JSON at the Anthropic provider's
`DEFAULT_MAX_TOKENS` cap (8000) — India-grounded content cites more statutes/sections than the
old US-law baseline, so the `{ content, flaggedClaims }` envelope needed more room to close.
Truncated JSON fails to parse and silently fell back to one defensive flag per artefact instead
of the real claim list, which meant the first run couldn't actually demonstrate the "worklist
flags Indian citations" half of this ADR — only the content-grounding half. Per ADR 0017's own
enforcement spirit (don't spend a second live call without a reason), the cap was raised to
16000 and the run repeated once, rather than accepted as-is or repeated speculatively.

The second run confirmed grounding AND raised the DEFAULT_MAX_TOKENS fix worked (no more
truncation) — but the textual artefact still fell back to a defensive flag, this time for a
different, pre-existing reason: the model emitted a literal unescaped control character inside
a JSON string value (`Bad control character in string literal in JSON`), the same failure class
ADR 0017 first documented. This is accepted, already-designed-for behaviour (`parseArtefactResponse`'s
fallback exists exactly for this), not a new bug and not something this ADR's scope covers —
a third live call to chase non-deterministic model formatting was judged not worth it. The slide
artefact from this second run parsed cleanly with 13 real, India-specific flagged claims, which
is what's promoted to `fixtures/artefacts.v3/employee-relations.json` alongside the textual
artefact's raw (unparsed) capture, documented as such in the fixture's `note` field.
