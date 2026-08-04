# ADR 0006 — Router dispatches to domain configs, not expert models

**Status:** Accepted (contract v0.3) · **Build:** after M1

## Context

Desired experience: "give it anything, it generates a course," with internal routing by
domain/sub-domain/level/material-type. "Mixture of experts" can mean separate specialized
_models_ — a training/ops appliance we don't need and which fragments the multi-field thesis.

## Decision

The router dispatches to domain-specialized **prompt/config bundles** (system prompt +
substrate + artefact templates), **not** to separate models. One general model, many expert
_configurations_. The router is a dispatch function behind Seam 1 — no new seam. It composes
with the (deferred) tier gate.

**Sequencing:** not in M1. M1 proves a single general prompt handles fields agnostically;
the router is added afterward to specialize only the fields M1 shows are weak.

## Consequences

Adding a field = adding a config bundle, not training a model. The general engine stays
intact; specialization is additive and cheap.
