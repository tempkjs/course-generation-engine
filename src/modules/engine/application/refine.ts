// Refine use-case: composes the pure domain tree ops with the LLM seam for 'regenerate'
// edits. Shared by MockCourseEngine and LiveCourseEngine — AI_MODE decides which LlmProvider
// getLlmProvider() resolves to (MockLlmProvider vs AnthropicLlmProvider); this file doesn't
// know or care, which is the point of Seam 2.
import type { Course, Edit } from '@/contracts';
import { getLlmProvider } from '@/modules/llm';
import { buildRefinePrompt } from '../prompts/refine.v1';
import {
  applyEdits,
  applyRegeneratedNode,
  assertDraftForRefine,
  findRefineTarget,
  parseRefineResponse,
} from '../domain/curriculum';

export async function refineCourse(course: Course, edits: Edit[]): Promise<Course> {
  assertDraftForRefine(course);

  let next = course;
  for (const edit of edits) {
    if (edit.op !== 'regenerate') {
      next = applyEdits(next, [edit]);
      continue;
    }
    const target = findRefineTarget(next, edit.nodeId);
    if (!target) continue; // node no longer exists (e.g. removed earlier in this same batch)

    const prompt = buildRefinePrompt({
      kind: target.kind,
      courseTitle: next.title,
      field: next.field,
      currentTitle: target.currentTitle,
      currentSummary: target.currentSummary,
      currentObjectives: target.currentObjectives,
      instruction: edit.instruction,
    });
    const raw = await getLlmProvider().generate(prompt);
    next = applyRegeneratedNode(next, edit.nodeId, parseRefineResponse(raw));
  }
  return next; // status stays 'draft' — approveCurriculum is the only draft -> validated path
}
