import "server-only";
import type { CourseEngine } from "@/contracts";
import { getConfig } from "@/shared/config";
import { MockCourseEngine } from "../infrastructure/engineMock";
import { LiveCourseEngine } from "../infrastructure/engineLive";
// LiveCourseEngine (Phase 1 only) composes getLlmProvider(); knowledge-cache composition
// (seam 3) and artefact generation (Phase 2) land in later milestones.
export function getCourseEngine(): CourseEngine {
  const { aiMode } = getConfig();
  return aiMode === "live" ? new LiveCourseEngine() : new MockCourseEngine();
}
