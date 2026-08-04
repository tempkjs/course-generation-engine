# ADR 0002 — Six seams as modular-monolith modules

**Status:** Accepted

## Context

The architecture defines six integration seams. We need them physically enforced so an
AI team can't accidentally couple across them (the failure the first vibe-coded CMS showed).

## Decision

Each seam maps to a module (`engine`, `llm`, `knowledge`, `lms`, `events`) plus a shared
`contracts` layer. Modules expose only `index.ts`; cross-module deep imports are banned
and CI-enforced. SOURCE (cache) and BUILD (course) are separated at the module level:
`knowledge` owns the cache, `engine` owns the course build.

## Consequences

Parallel assembly lines (Bolt UI, Claude Code engine) can build against stable interfaces.
Swapping a bought component (LLM, RAG infra, LMS) touches only that module's infrastructure.
