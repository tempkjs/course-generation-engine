// Documented live-mode check (milestone 1 DoD). Skipped unless AI_MODE=live — run with:
//   ANTHROPIC_API_KEY=... pnpm test:live
import { describe, it, expect } from 'vitest';
import { getCourseEngine } from '@/modules/engine/server';

const isLive = process.env.AI_MODE === 'live';

describe.skipIf(!isLive)('CourseEngine (AI_MODE=live) — cross-field credibility check', () => {
  const requests = [
    { topic: 'Contracts for Founders', field: 'legal' },
    { topic: 'Hiring & Interviewing Well', field: 'hr' },
    { topic: 'Hindustani Vocal toward performance', field: 'arts' },
  ];

  it('produces credible, distinct, field-appropriate curricula', async () => {
    const engine = getCourseEngine();
    const courses = await Promise.all(
      requests.map(({ topic, field }) =>
        engine.generateCurriculum({
          topic, field, level: 'basic',
          audienceExperience: 'motivated beginner', durationWeeks: 4,
          cadence: 'weekend-2x2', practitionerId: 'p-live-check',
          style: { practitionerId: 'p-live-check', modalities: ['textual'], tone: 'plain', depth: 'working' },
        }),
      ),
    );

    for (const course of courses) {
      expect(course.status).toBe('draft');
      expect(course.modules.length).toBeGreaterThan(0);
      // eslint-disable-next-line no-console
      console.log(`\n=== ${course.field}: ${course.title} ===`);
      console.log(JSON.stringify(course.modules.map((m) => m.title), null, 2));
    }

    const titleSets = courses.map((c) => JSON.stringify(c.modules.map((m) => m.title)));
    expect(new Set(titleSets).size).toBe(titleSets.length); // distinct across fields
  }, 120_000);
});
