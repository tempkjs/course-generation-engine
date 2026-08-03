import type { CourseEngine, GenerateRequest, Edit, Course, Artefact, ArtefactType, StyleProfile } from '@/contracts';
import { applyEdits } from '../domain/curriculum';
// AI_MODE=mock CourseEngine: deterministic, no external calls, but a REAL structured draft
// through the REAL interface — so the harness (and later the website) exercise the true seam.
export class MockCourseEngine implements CourseEngine {
  async generateCurriculum(req: GenerateRequest): Promise<Course> {
    const id = `course-${req.topic.toLowerCase().replace(/\s+/g, '-')}`;
    return {
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
  }
  async refineCurriculum(courseId: string, edits: Edit[]): Promise<Course> {
    const base = await this.generateCurriculum({
      topic: courseId.replace(/^course-/, '').replace(/-/g, ' '),
      field: 'software', level: 'medium', audienceExperience: '', durationWeeks: 5,
      cadence: 'weekend-2x2', practitionerId: 'p-mock',
      style: { practitionerId: 'p-mock', modalities: ['textual'], tone: 'plain', depth: 'working' },
    });
    return applyEdits(base, edits);
  }
  async generateArtefacts(courseId: string, prefs: ArtefactType[], _style: StyleProfile): Promise<Artefact[]> {
    return prefs.map((type, i) => ({
      id: `${courseId}-art-${i}`, type, contentRef: `mock://${courseId}/${type}`,
      generatedBy: 'engine', approved: false,
    }));
  }
  async commitToCache(_courseId: string): Promise<void> { /* mock: no-op flywheel write */ }
}
