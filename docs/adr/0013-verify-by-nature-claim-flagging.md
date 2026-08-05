# ADR 0013 — Verify-by-nature claim flagging (not stable-vs-volatile tagging)

**Status:** Accepted. Build deferred to a dedicated milestone (candidate: M3.5, or folded
into M4). Contract impact (`Artefact` shape) is real but lands when built, not now.

## Context

The CA/GST live run produced content that is fluent, specific, well-structured, and
_mostly_ right — and that is precisely the danger. The most convincing passages contained
confident perishable assertions: a Supreme Court case by name and year (_Safari Retreats_,
2024), a second case cited as settled protective authority (_Bharti Airtel_), specific
rupee thresholds, statutory deadlines (30 November under §16(4)), a flat 5% figure, a
deemed 60-month capital-goods life. Each was stated with the same confidence as genuinely
stable material. This is the fluent-but-possibly-wrong profile: good enough that a busy
practitioner is tempted to approve it with a skim — which is exactly when a superseded rule
ships as fact.

The practitioner-validation gate (ADR 0005) is the backstop. But a backstop that isn't
_directed_ won't be used: "re-read all of this skeptically" is not a thing a busy CA
actually does.

## The rejected alternative — binary "stable concept vs. volatile current"

The intuitive design is to tag topics as either stable-conceptual (AI's domain, trust it)
or volatile-current (practitioner's domain, verify it). **Rejected**, for four reasons:

1. **The boundary smears.** In a regulation-bound domain there is almost no pure-stable
   content. §16(2)'s "four conditions" feel timeless — until the 2021 §16(2)(aa) amendment
   made the third depend on GSTR-2B matching. A "stable" tag mislabels exactly the content
   most likely to have silently moved: the stuff that _was_ stable and got amended.
2. **The AI cannot self-assess which side a claim is on.** The same stale knowledge that
   produces an out-of-date rule will confidently tag that rule as "stable concept." The
   tagger inherits the failure it is meant to catch.
3. **An attention-directing tag can _reduce_ safety.** Telling the practitioner "scrutinise
   the volatile parts" implies the untagged remainder is safe — which points their scrutiny
   _away_ from the mislabeled-stable landmine. A validation aid that directs attention can
   direct it away from the failure it didn't see.
4. **Per-domain tagging is the appliance trap.** Hand-authoring "in GST, watch the rates"
   rules per field doesn't scale and fragments the general engine.

## Decision

Flag **verify-by-nature claim _types_, not stable/volatile _topics_.** Certain kinds of
claim are inherently checkable-and-perishable and — crucially — are **detectable by their
form, without any correctness judgment.** The engine does not need to know whether _Safari
Retreats_ is stated correctly; it only needs to recognise "this is a case citation, and
case citations are verify-by-nature." That is a structural classification it can do
reliably.

Verify-by-nature claim types (initial set — taxonomy to be finalised at build):

- Case-law citations (named cases, holdings)
- Statutory/regulatory references (section, rule, clause numbers)
- Rates, thresholds, monetary limits, percentages
- Dates and statutory deadlines
- "Recent / new / latest / amended / w.e.f." claims (anything asserting currency)
- Named standards/versions (Ind AS numbers, software versions, form numbers)

The engine flags instances of these types **inline, regardless of whether the surrounding
material feels stable**, and emits a **verification checklist** at the lesson/course level.

### The callout is a checklist, not a warning

Not: "this section may be outdated" (vague → invites skimming). Instead: "This lesson
contains N claims requiring verification: [3 case citations, 2 rate/threshold figures, 1
statutory deadline] — each flagged inline; confirm each against current law before use."
This converts an un-actionable instruction ("re-read skeptically") into an actionable one
("verify these N specific things").

### Two hard rules on the callout

- **Never imply the unflagged remainder is safe.** The checklist covers only what is
  _provably perishable by type_. The practitioner's professional judgment remains the
  backstop for everything else. The system must not lull it.
- **Universal, per-claim-type, built once — not per-domain.** A case citation in law, a
  dose in medicine, a rate in tax, a standard-version in accounting are the same problem.
  Build the flagger on claim-type, once, across all fields.

## Consequences

- **Contract impact (at build):** the `Artefact` data model gains a structured
  flagged-claims representation (claim type + location/span + optional note), and there is
  a lesson/course-level verification checklist. This is a contract change → version bump
  _when built_, not now.
- The generation prompt (a new `artefacts.v2` when built) emits flags + checklist.
- The eventual practitioner-validation UI surfaces the checklist as the practitioner's
  worklist.
- **This is the concrete, demonstrated justification for ADR 0005** (read-mostly, curated
  cache; practitioner makes it correct). GST proved the engine's drafts are credible enough
  that the human gate is the only thing between "impressive" and "filing-ready wrong."

## Open sub-questions (resolve at build)

- Final claim-type taxonomy.
- Representation: inline markers, a separate structured list, or both.
- Whether flagging is part of generation or a post-generation pass over the content.

## Build note

**Not built as part of M3.** Recorded here so the decision isn't lost and so M3's closeout
(ADR 0014/0015/0016) doesn't quietly absorb scope that deserves its own milestone. Nothing
in `Artefact`, `prompts/artefacts.v1.ts`, or the generation pipeline changed for this ADR.
