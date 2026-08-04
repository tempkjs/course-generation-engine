# ADR 0005 — Read-mostly, curated knowledge cache (write-back deferred)

**Status:** Accepted (contract v0.3)

## Context

A tempting flywheel is to write practitioner-edited, approved curricula back into the
domain substrates. But one bad edit degrades a substrate hundreds of practitioners draw
from, and we cannot tell a good edit from a lazy one automatically at ingest time.

## Decision

The cache is **read-mostly**. Substrates are authored/curated, not learned from live edits.
No automatic write-back at MVP. Substrate quality comes from the generation prompt — a
**"pro L&D manager" baseline** producing a good-for-most curriculum only a genuinely
experienced trainer would improve on. `KnowledgeWriter` is a curation/authoring path, not a
live practitioner write.

**Deferred (door left open):** later, measure use-as-is vs. edited rates; if positively-
received edit patterns emerge, add a _governed_ write-back ingesting only vetted curricula.

## Consequences

Cache floor stays high, blast radius zero. Removes concurrency/quality risk from the early
build. The write-back is a future, data-earned feature, not an assumption.
