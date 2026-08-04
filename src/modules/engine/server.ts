// Server-only public entry for the engine module. Only /api route handlers (and tests
// running under Node) may import from here — never a 'use client' component. See
// STANDING_GOTCHAS.md for why this is split from ./index.ts, and ADR 0010 for the two-barrel
// decision.
//
// getCourse / getArtefactContent are test/route-facing peeks into the Seam-4 mock stores
// (courseStore, contentStore) — NOT part of the CourseEngine (Seam 1) contract, which has no
// "read a course" or "read artefact content" method. They exist because generateArtefacts
// returns Artefact[] (contentRef pointers only, never raw content — invariant 3), so there is
// no other way for a server-side test to inspect what got attached to a lesson or read the
// content behind a contentRef. See ADR 0011.
import "server-only";
export { getCourseEngine } from "./application/orchestrator";
export { getCourse } from "./infrastructure/courseStore";
export { getContent as getArtefactContent } from "./infrastructure/contentStore";
export type { CourseEngine, GenerateRequest, Edit } from "@/contracts";
