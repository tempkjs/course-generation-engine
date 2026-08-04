# ADR 0004 — Two-phase generation, gated on curriculum approval

**Status:** Accepted (contract v0.3)

## Context

Generating the detailed course (artefacts for every lesson) is the expensive, high-token
operation. Doing it before the practitioner has approved the curriculum wastes cost on
structure they were going to reshape, and risks shipping unreviewed material.

## Decision

Two separately-costed phases with a human gate:

1. Phase 1 — curriculum draft (cheap-ish: structure, titles, objectives).
2. Practitioner adds/removes/(future edits)/approves → status `draft → validated`.
3. Phase 2 — detailed course (expensive: style-conditioned artefacts).

**Enforced invariant:** `generateArtefacts` throws unless `course.status === 'validated'`.
The status ladder `generating → draft → validated → published` is enforced, not conventional.
Mirrors CareerAsana's task-list-approval-before-execution-plan flow.

## Consequences

The big spend never fires speculatively. Quality and cost control land in one gate.
`refineCurriculum` operates only in `draft`; `commitToCache`/publish only from `validated`+.
