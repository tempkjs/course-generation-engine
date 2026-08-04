# ADR 0007 — Model tier deferred (Haiku out); single standard model

**Status:** Accepted (contract v0.3) · **Supersedes** the M1a tier-gate plan

## Context

An earlier plan added light/standard tiers (Haiku/Sonnet) for cost control. But nearly all
engine work (curriculum, artefacts) is medium-to-high complexity — there is no cheap-task
category worth splitting yet, and a weak draft poisons practitioner trust (the moat).

## Decision

Use a **single standard (Sonnet-class) model** for now. The tier gate is **deferred, not
built.** Revisit when a genuinely mechanical, high-volume task category emerges (bulk
metadata tagging, title/summary reformatting) where a cheaper model won't hurt quality.
Quality gate first, cost gate second.

## Consequences

No dormant tier machinery to maintain. The M1a prompt is superseded — do not build it.
