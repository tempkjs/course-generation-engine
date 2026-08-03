import { describe, it, expect } from 'vitest';
import { getCourseEngine } from '@/modules/engine';

describe('CourseEngine (AI_MODE=mock)', () => {
  it('generates a draft course with modules, no external calls', async () => {
    const engine = getCourseEngine();
    const course = await engine.generateCurriculum({
      topic: 'Contracts for Founders', field: 'legal', level: 'basic',
      audienceExperience: 'founders', durationWeeks: 3, cadence: 'weekend-2x2',
      practitionerId: 'p-1',
      style: { practitionerId: 'p-1', modalities: ['textual'], tone: 'plain', depth: 'working' },
    });
    expect(course.status).toBe('draft');
    expect(course.modules.length).toBeGreaterThan(0);
    expect(course.field).toBe('legal');
  });

  it('refine removes a module', async () => {
    const engine = getCourseEngine();
    const c = await engine.generateCurriculum({
      topic: 'x', field: 'software', level: 'medium', audienceExperience: '', durationWeeks: 5,
      cadence: 'weekend-2x2', practitionerId: 'p',
      style: { practitionerId: 'p', modalities: ['textual'], tone: 'plain', depth: 'working' },
    });
    const removedId = c.modules[0]!.id;
    const after = await engine.refineCurriculum(c.id, [{ op: 'remove', nodeId: removedId }]);
    expect(after.modules.find((m) => m.id === removedId)).toBeUndefined();
  });
});
