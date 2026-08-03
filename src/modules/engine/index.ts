// Public API of the engine module. UIs import ONLY from here.
export { CourseEngineClient } from './ui/client';
export { getCourseEngine } from './application/orchestrator';
export type { CourseEngine, GenerateRequest, Edit } from '@/contracts';
