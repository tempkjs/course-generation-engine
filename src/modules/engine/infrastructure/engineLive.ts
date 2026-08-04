import "server-only";
import type {
  CourseEngine,
  GenerateRequest,
  Edit,
  Course,
  Artefact,
  ArtefactType,
  StyleProfile,
} from "@/contracts";
import { getLlmProvider } from "@/modules/llm";
import { buildCurriculumPrompt } from "../prompts/curriculum.v1";
import {
  assertApprovable,
  assertValidatedForArtefacts,
  parseCurriculumResponse,
} from "../domain/curriculum";
import { refineCourse } from "../application/refine";
import { getCourse, putCourse, requireCourse } from "./courseStore";

// AI_MODE=live CourseEngine: Phase 1 (generateCurriculum) and the refine loop compose the
// real LLM provider; Phase 2 (generateArtefacts) proves the approval gate opens but returns
// placeholder content — real artefact generation is a later milestone. Draft state lives in
// the shared process-level courseStore (Seam-4 mock) — see engineMock.ts for why per-instance
// state doesn't survive across separate HTTP requests.
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
    _style: StyleProfile,
  ): Promise<Artefact[]> {
    assertValidatedForArtefacts(getCourse(courseId));
    // Phase 2 content generation is out of scope for this milestone — this stub proves the
    // approval gate opens without paying for real artefact generation. See ADR 0004.
    return prefs.map((type, i) => ({
      id: `${courseId}-art-${i}`,
      type,
      contentRef: `live-stub://${courseId}/${type}`,
      generatedBy: "engine",
      approved: false,
    }));
  }

  async commitToCache(_courseId: string): Promise<void> {
    throw new Error(
      "LiveCourseEngine.commitToCache is not yet implemented (later milestone).",
    );
  }
}
