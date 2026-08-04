// Server-only public entry for the engine module. Only /api route handlers (and tests
// running under Node) may import from here — never a 'use client' component. See
// STANDING_GOTCHAS.md for why this is split from ./index.ts.
import "server-only";
export { getCourseEngine } from "./application/orchestrator";
export type { CourseEngine, GenerateRequest, Edit } from "@/contracts";
