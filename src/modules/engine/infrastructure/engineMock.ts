import type { CourseEngine, GenerateRequest, Edit, Course, Artefact, ArtefactType, StyleProfile } from '@/contracts';
import { assertApprovable, assertValidatedForArtefacts } from '../domain/curriculum';
import { refineCourse } from '../application/refine';
import { getCourse, putCourse, requireCourse } from './courseStore';
// AI_MODE=mock CourseEngine: deterministic Phase 1 (no external calls), but a REAL structured
// draft through the REAL interface — so the harness (and later the website) exercise the true
// seam. Draft state lives in the shared process-level courseStore (Seam-4 mock), not on `this`
// — getCourseEngine() returns a new instance per call, so per-instance state would not survive
// across the separate generate/refine/approve/generateArtefacts HTTP requests.
export class MockCourseEngine implements CourseEngine {
  async generateCurriculum(req: GenerateRequest): Promise<Course> {
    const id = `course-${req.topic.toLowerCase().replace(/\s+/g, '-')}`;
    const course: Course = {
      id, status: 'draft', title: req.topic, field: req.field, level: req.level,
      practitionerId: req.practitionerId, priceBand: 'standard', cadence: req.cadence,
      sourceRefs: [], createdAt: new Date(0).toISOString(),
      modules: [1, 2, 3].map((n) => ({
        id: `${id}-m${n}`, order: n, title: `Module ${n}: ${req.topic}`,
        summary: `Draft module ${n} (mock).`,
        lessons: [{
          id: `${id}-m${n}-l1`, order: 1, title: `Lesson ${n}.1`,
          objectives: [`Understand part ${n}`], delivery: n === 1 ? 'live' : 'async', artefacts: [],
        }],
      })),
    };
    return putCourse(course);
  }
  async refineCurriculum(courseId: string, edits: Edit[]): Promise<Course> {
    const after = await refineCourse(requireCourse(courseId), edits);
    return putCourse(after);
  }
  async approveCurriculum(courseId: string): Promise<Course> {
    const course = requireCourse(courseId);
    assertApprovable(course);
    return putCourse({ ...course, status: 'validated' });
  }
  async generateArtefacts(courseId: string, prefs: ArtefactType[], _style: StyleProfile): Promise<Artefact[]> {
    assertValidatedForArtefacts(getCourse(courseId));
    return prefs.map((type, i) => ({
      id: `${courseId}-art-${i}`, type, contentRef: `mock://${courseId}/${type}`,
      generatedBy: 'engine', approved: false,
    }));
  }
  async commitToCache(_courseId: string): Promise<void> { /* mock: no-op flywheel write */ }
}
