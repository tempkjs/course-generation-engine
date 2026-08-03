// Seam 1 CLIENT — the ONLY thing a UI imports. The disposable harness AND the real
// Swakojo Academy website both import this. Plug-and-play: same client, different host.
import type { CourseEngine, GenerateRequest, Edit, ArtefactType, StyleProfile } from '@/contracts';
import { getCourseEngine } from '../application/orchestrator';

// In-process now; swap the impl for an HTTP client against the deployed engine API later,
// WITHOUT changing this interface — the website's call sites stay identical.
export class CourseEngineClient implements CourseEngine {
  private engine: CourseEngine = getCourseEngine();
  generateCurriculum(req: GenerateRequest) { return this.engine.generateCurriculum(req); }
  refineCurriculum(courseId: string, edits: Edit[]) { return this.engine.refineCurriculum(courseId, edits); }
  generateArtefacts(courseId: string, prefs: ArtefactType[], style: StyleProfile) {
    return this.engine.generateArtefacts(courseId, prefs, style);
  }
  commitToCache(courseId: string) { return this.engine.commitToCache(courseId); }
}
