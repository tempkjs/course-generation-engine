# ADR 0016 — One canonical contract (in the repo); standalone copy retired

**Status:** Accepted. Implemented as part of the M3 seal. No seam change, no version bump
(governance; recorded in the changelog).

## Context

Two copies of the integration contract were maintained in parallel: the repo's
`docs/integration-contract.md` (moved forward by the build — v0.4, ADRs 0008–0012) and a
standalone reference copy outside the repo (stalled at v0.3). They diverged. This is the
exact two-diverging-copies hazard flagged during the CareerAsana-reuse discussion —
appearing in our own process. With two "live" copies, someone eventually trusts the stale
one.

A recommendation to fix this was recorded as a note, but a note is not enforcement — "a
rule worth having is a rule that's enforced, not one that lives in a comment." So this is
promoted from note to decision.

## Decision

There is exactly **ONE** canonical integration contract: `docs/integration-contract.md` in
the repo. Any copy elsewhere is a point-in-time **snapshot**, not a living document. All
contract changes happen in the repo copy only.

Add a one-line rule at the very top of `docs/integration-contract.md`, directly under the
version header:

> Canonical source: this file, in the repo. Any copy elsewhere is a dated snapshot, not
> authoritative.

The architect's outside-repo reference copy is henceforth a retired, dated snapshot
(v0.3-era) — not maintained forward, not authoritative.

## Consequences

- No code/seam change. Governance only; recorded in the changelog.
- Removes the drift class entirely: there is nowhere for a second "live" contract to exist.
- Decisions are read from and written to the repo copy.

## Build note

The rule line is inserted directly under the `Status`/`Contract version` header in
`docs/integration-contract.md`, ahead of the `Sits under`/`Governs` lines. Landed in the
same v0.5 changelog entry as ADR 0014, since both ship in the same commit — no separate
version bump for this ADR (governance only, per Decision above).
