# ADR 0013 — Verify-by-nature claim flagging + de-personified reference material

**Status:** Accepted, **BUILT** (M3.5). Contract v0.6 — `Artefact` gained `flaggedClaims`.

## Context

The CA/GST live run produced content that is fluent, specific, well-structured, and _mostly_
right — and that is precisely the danger. The most convincing passages contained confident
perishable assertions: a Supreme Court case by name and year (_Safari Retreats_, 2024), a
second case cited as settled protective authority (_Bharti Airtel_), specific rupee
thresholds, statutory deadlines (30 November under §16(4)), a flat 5% figure, a deemed
60-month capital-goods life. Each was stated with the same confidence as genuinely stable
material. This is the fluent-but-possibly-wrong profile: good enough that a busy practitioner
is tempted to approve it with a skim — which is exactly when a superseded rule ships as fact.

The same run also revealed a second, independent failure mode: the content was written in
first person, AS the practitioner ("I insist," "in my experience," "I've seen this trip up
half my clients"), and invented specific-sounding statistics to sell that voice (e.g. a
fabricated "±₹5,000 per vendor" figure with no real basis). This wasn't a verification
problem — no amount of claim-flagging fixes a fabricated anecdote, because the anecdote isn't
a claim to verify, it's content that should never have been generated at all.

The practitioner-validation gate (ADR 0005) is the backstop for both. But a backstop that
isn't _directed_ won't be used: "re-read all of this skeptically" is not a thing a busy CA
actually does — and no backstop at all catches a fabrication that reads as authentically
lived-in.

## Decision 1 — Flag verify-by-nature claim TYPES, not stable/volatile TOPICS

**The rejected alternative — binary "stable concept vs. volatile current":** the intuitive
design is to tag topics as either stable-conceptual (AI's domain, trust it) or
volatile-current (practitioner's domain, verify it). Rejected, for four reasons:

1. **The boundary smears.** In a regulation-bound domain there is almost no pure-stable
   content. §16(2)'s "four conditions" feel timeless — until the 2021 §16(2)(aa) amendment
   made the third depend on GSTR-2B matching. A "stable" tag mislabels exactly the content
   most likely to have silently moved: the stuff that _was_ stable and got amended.
2. **The AI cannot self-assess which side a claim is on.** The same stale knowledge that
   produces an out-of-date rule will confidently tag that rule as "stable concept." The
   tagger inherits the failure it is meant to catch.
3. **An attention-directing tag can _reduce_ safety.** Telling the practitioner "scrutinise
   the volatile parts" implies the untagged remainder is safe — which points scrutiny _away_
   from the mislabeled-stable landmine.
4. **Per-domain tagging is the appliance trap.** Hand-authoring "in GST, watch the rates"
   rules per field doesn't scale and fragments the general engine.

**What we do instead:** flag verify-by-nature claim _types_, detectable by their **form**,
without any correctness judgment. The engine does not need to know whether _Safari Retreats_
is stated correctly; it only needs to recognise "this is a case citation, and case citations
are verify-by-nature." Governing rule (a principle, not a fixed list): flag every non-static
claim — anything that is not settled, static fact. Concretely, at minimum:

- **citation** — case-law/authority citations, named rulings/precedent
- **date** — any specific date, deadline, or "as of"/effective-from point
- **unsettled** — any point not yet decided by an authoritative body (live litigation,
  disputed interpretation, pending amendment)
- **figure** — any rate, threshold, monetary amount, percentage, numeric limit
- **product** — any named product, vendor, platform, or software
- **other-nonstatic** — anything else asserting current status ("recent"/"latest"/"as
  amended"/"w.e.f.", a version/standard number)

**In-generation, same call, no separate pass:** the artefact prompt (`prompts/artefacts.v2.ts`)
returns a JSON envelope, `{ content, flaggedClaims }`, in the SAME LLM call that produces the
content. No detection pass over already-generated text, no extra call — flagging is
free in cost (Seam 2 call count is unchanged from v1).

**The callout is a checklist, not a warning.** Not "this section may be outdated" (vague →
invites skimming). Instead: "N claims requiring verification: 3 citations, 2 figures, 1
deadline — confirm each before use." `domain/artefacts.ts`'s `buildVerificationChecklist`
derives exactly this (count by type + the flat claim list) from a set of artefacts — a
derivation over `Artefact[]`, not a new stored field, so a lesson- or course-level checklist
is just "which artefacts you pass in."

**Two hard rules on the callout, unchanged from the original decision:**

- Never imply the unflagged remainder is safe — the checklist covers only what's provably
  perishable by type; the practitioner's judgment remains the backstop for everything else.
- Universal, per-claim-type, built once — not per-domain. A case citation in law and a
  dosage in medicine are the same shape of problem.

### Logged tradeoff — false negatives on the model's own overconfident claims

**In-generation flagging is asking the model to flag its own claims, in the same breath it
made them.** A model that is confidently wrong about a claim's status (e.g. it "knows" a
superseded rule as current fact, not as an assertion worth flagging) is exactly as likely to
under-flag that claim as it was to state it wrongly in the first place — the failure and the
safety net share a root cause. This is a **real, accepted limitation**, not an oversight:

- **Why accepted anyway:** the practitioner-validation gate (ADR 0005) is the actual backstop
  regardless of flag accuracy — nothing here is claimed to be a substitute for practitioner
  review, only a worklist to focus it. Even an imperfect, type-detectable flag list is
  strictly better than none: it catches the mechanically-detectable majority (every citation,
  every date, every figure) even when it misses a mis-confident edge case.
  Decision 2's fabrication _prevention_ (below) is deliberately strictly separate from this
  detection, precisely because detection alone would leave fabricated content dependent on
  the same self-assessment that can't be trusted for it.
- **The stronger future version:** a separate, structural detection pass — pattern-matching
  or a second model call over the generated content, independent of the generating call's own
  self-assessment — would not share this blind spot. Out of scope here (it's a second LLM
  call, real added cost, and a real design decision of its own); flagged as the natural next
  step if in-generation flagging proves insufficient in practice.

## Decision 2 — De-personified reference material (prevention, not detection)

Artefacts are **reference material** — a PDF/PPT handout the practitioner hands learners —
not a transcript of someone talking. `prompts/artefacts.v1.ts`'s "ghostwriting AS the
practitioner" framing produced first-person voice and fabricated specifics as a direct
consequence of asking the model to **be** a person with experience; the fix is at the
framing, not a filter after the fact.

- **No first person, ever.** No "I," "my," "in my experience," "I've seen," "I insist," or
  any variant. Third person / imperative / declarative instead.
- **No invented anecdotes or fabricated statistics-as-experience** (e.g. "30-40% in my
  experience," "±₹5,000 per vendor"). These must **never be generated** — prevention at
  source, strictly better than flagging them after, because a flagged fabrication is still a
  fabrication a skimming practitioner can miss the flag on. If there's no real, citable basis
  for a specific figure, the content states the factor qualitatively or omits it.
- **StyleProfile conditions RIGOR, not PERSONA.** "rigorous tone / deep depth" means more
  complete and more explicitly caveated content — more edge cases, more exceptions covered —
  **not** "a rigorous-sounding narrator." Impersonal does not mean sterile: still clear,
  direct, well structured, just without a first-person voice or invented specifics.
- Any genuine figure/date/citation that DOES appear is expected and welcome — it's a
  non-static claim and gets flagged under Decision 1. Decision 2 bans **fabricated**
  specificity; it does not ban **real, attributable** specificity.

Decisions 1 and 2 are independent and complementary: Decision 2 prevents the class of error
no detection pass could safely catch (a fabrication that reads as genuine); Decision 1
surfaces the class of error that's real but perishable. Neither substitutes for the other.

## Consequences

- **Contract (v0.6):** `Artefact` gains `flaggedClaims: FlaggedClaim[]` (`[]` when nothing
  flagged). This is a payload change on an existing Seam 1 method's return shape, not a new
  method — see the integration contract's v0.6 changelog entry.
- `prompts/artefacts.v2.ts` (new, versioned; v1 untouched) carries both decisions.
  `application/generateArtefacts.ts` parses the envelope and attaches `flaggedClaims` to each
  `Artefact`; stored content (`contentRef`) is the `content` field only — flags never enter
  the content blob.
- No added Seam 2 cost: one LLM call per artefact, same as v1.
- **This is the concrete, demonstrated justification for ADR 0005** (read-mostly, curated
  cache; practitioner makes it correct). GST proved the engine's drafts are credible enough,
  and confidently wrong enough, that the human gate is the only thing between "impressive"
  and "filing-ready wrong" — and that gate needed both a narrower failure surface (Decision 2)
  and a worklist to focus it (Decision 1), not just a general exhortation to be careful.
- The eventual practitioner-validation UI surfaces `buildVerificationChecklist`'s output as
  the practitioner's worklist — not built yet, this ADR only lands the data and the
  derivation.

## Resolved sub-questions (were open at deferral; resolved at build)

- **Claim-type taxonomy:** the six types listed under Decision 1, encoded as
  `FlaggedClaim['type']`. Extensible later (additive, no version bump for a new variant of an
  existing open-ended union member — a genuinely new type is a small additive contract change).
- **Representation:** a structured list on the `Artefact` (`flaggedClaims`), each entry
  carrying the exact `text` span so it's locatable in the content, plus an optional `note`.
  No inline in-content markers — kept the content blob itself unmarked-up, matching "reference
  material," and left rendering/highlighting to whatever UI consumes `flaggedClaims` later.
- **Generation vs. post-pass:** in-generation, one call — see the logged tradeoff above for
  what that costs in reliability, and why it was accepted anyway.
