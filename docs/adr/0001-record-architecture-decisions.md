# ADR 0001 — Record architecture decisions

**Status:** Accepted

## Context

This engine is built by an AI team across sessions that don't share memory. Coherence
must live in the repo, not in anyone's head.

## Decision

We record real architectural decisions as ADRs (this format). Small/reversible choices
don't need one. The integration contract (`docs/integration-contract.md`) is the
authoritative boundary map; ADRs explain _why_ it says what it says.

## Consequences

Any change to `src/contracts` or a seam requires an ADR and an integration-contract
version bump. Design-layer changes behind a seam do not.
