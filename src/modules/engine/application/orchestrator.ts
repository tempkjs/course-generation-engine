import type { CourseEngine } from '@/contracts';
import { getConfig } from '@/shared/config';
import { MockCourseEngine } from '../infrastructure/engineMock';
// The live orchestrator will compose getLlmProvider() + getKnowledgeRetriever()/Writer()
// + style conditioning. In mock mode we return the deterministic mock engine.
// TODO(seam-1, live): implement LiveCourseEngine composing seams 2 & 3, writing back via seam 3.
export function getCourseEngine(): CourseEngine {
  const { aiMode } = getConfig();
  if (aiMode === 'mock') return new MockCourseEngine();
  return new MockCourseEngine(); // placeholder until LiveCourseEngine lands
}
