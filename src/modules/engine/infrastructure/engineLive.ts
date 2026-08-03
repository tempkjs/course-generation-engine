import 'server-only';
import type { CourseEngine, GenerateRequest, Edit, Course, Artefact, ArtefactType, StyleProfile } from '@/contracts';
import { getLlmProvider } from '@/modules/llm';
import { buildCurriculumPrompt } from '../prompts/curriculum.v1';
import { parseCurriculumResponse } from '../domain/curriculum';

// AI_MODE=live CourseEngine: Phase 1 (generateCurriculum) composes the real LLM provider.
// Phase 2 / refine loop / cache write-back are later milestones — see ADR 0004, ADR 0006.
export class LiveCourseEngine implements CourseEngine {
  async generateCurriculum(req: GenerateRequest): Promise<Course> {
    const llm = getLlmProvider();
    const prompt = buildCurriculumPrompt(req);
    const raw = await llm.generate(prompt);
    return parseCurriculumResponse(raw, req);
  }

  async refineCurriculum(_courseId: string, _edits: Edit[]): Promise<Course> {
    throw new Error('LiveCourseEngine.refineCurriculum is not yet implemented (later milestone).');
  }

  async generateArtefacts(_courseId: string, _prefs: ArtefactType[], _style: StyleProfile): Promise<Artefact[]> {
    throw new Error('LiveCourseEngine.generateArtefacts is not yet implemented (Phase 2, later milestone).');
  }

  async commitToCache(_courseId: string): Promise<void> {
    throw new Error('LiveCourseEngine.commitToCache is not yet implemented (later milestone).');
  }
}
