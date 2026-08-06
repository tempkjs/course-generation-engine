import "server-only";
import type {
  CourseEngine,
  GenerateRequest,
  Edit,
  Course,
  Artefact,
  ArtefactType,
  StyleProfile,
  GenerateArtefactsOpts,
} from "@/contracts";
import { getLlmProvider } from "@/modules/llm";
import { buildCurriculumPrompt } from "../prompts/curriculum.v2";
import {
  assertApprovable,
  assertValidatedForArtefacts,
  parseCurriculumResponse,
} from "../domain/curriculum";
import { refineCourse } from "../application/refine";
import { generateArtefactsForCourse } from "../application/generateArtefacts";
import { getCourse, putCourse, requireCourse } from "./courseStore";

// AI_MODE=live CourseEngine: Phase 1 (generateCurriculum), the refine loop, and Phase 2
// (generateArtefacts) all compose the real LLM provider. Draft state lives in the shared
// process-level courseStore (Seam-4 mock) — see engineMock.ts for why per-instance state
// doesn't survive across separate HTTP requests.
export class LiveCourseEngine implements CourseEngine {
  async generateCurriculum(req: GenerateRequest): Promise<Course> {
    const llm = getLlmProvider();
    const prompt = buildCurriculumPrompt(req);
    const raw = await llm.generate(prompt);
    return putCourse(parseCurriculumResponse(raw, req));
  }

  async refineCurriculum(courseId: string, edits: Edit[]): Promise<Course> {
    const after = await refineCourse(requireCourse(courseId), edits);
    return putCourse(after);
  }

  async approveCurriculum(courseId: string): Promise<Course> {
    const course = requireCourse(courseId);
    assertApprovable(course);
    return putCourse({ ...course, status: "validated" });
  }

  async generateArtefacts(
    courseId: string,
    prefs: ArtefactType[],
    style: StyleProfile,
    opts?: GenerateArtefactsOpts,
  ): Promise<Artefact[]> {
    const course = getCourse(courseId);
    assertValidatedForArtefacts(course);
    const { course: updated, artefacts } = await generateArtefactsForCourse(
      course,
      prefs,
      style,
      opts?.lessonIds,
    );
    putCourse(updated);
    return artefacts;
  }

  async commitToCache(_courseId: string): Promise<void> {
    throw new Error(
      "LiveCourseEngine.commitToCache is not yet implemented (later milestone).",
    );
  }
}
