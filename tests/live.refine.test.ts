// Documented live-mode check (milestone 2 DoD). Skipped unless AI_MODE=live — run with:
//   ANTHROPIC_API_KEY=... pnpm test:live
import { describe, it, expect } from "vitest";
import { getCourseEngine } from "@/modules/engine/server";
import type { Course, Lesson, StyleProfile } from "@/contracts";

const isLive = process.env.AI_MODE === "live";

function findLesson(course: Course, lessonId: string): Lesson {
  for (const m of course.modules) {
    const lesson = m.lessons.find((l) => l.id === lessonId);
    if (lesson) return lesson;
  }
  throw new Error(`lesson ${lessonId} not found in course ${course.id}`);
}

function logBeforeAfter(label: string, before: Lesson, after: Lesson): void {
  /* eslint-disable no-console -- diagnostic output for the manual before/after check */
  console.log(`\n=== ${label} — BEFORE ===`);
  console.log(`title: "${before.title}"`);
  console.log(`objectives: ${JSON.stringify(before.objectives)}`);
  console.log(`=== ${label} — AFTER ===`);
  console.log(`title: "${after.title}"`);
  console.log(`objectives: ${JSON.stringify(after.objectives)}`);
  /* eslint-enable no-console */
}

describe.skipIf(!isLive)(
  "CourseEngine (AI_MODE=live) — refine loop + approval gate",
  () => {
    it("regenerate: no instruction drifts minorly, a clear instruction actually redirects the lesson", async () => {
      const engine = getCourseEngine();
      const course = await engine.generateCurriculum({
        topic: "Hiring & Interviewing Well",
        field: "hr",
        level: "basic",
        audienceExperience: "first-time hiring manager",
        durationWeeks: 4,
        cadence: "weekend-2x2",
        practitionerId: "p-live-refine",
        style: {
          practitionerId: "p-live-refine",
          modalities: ["textual"],
          tone: "plain",
          depth: "working",
        },
      });
      expect(course.status).toBe("draft");
      expect(course.modules.length).toBeGreaterThanOrEqual(2);

      // Case A — no instruction: the baseline. Whatever change shows up here is just
      // the model's natural regeneration drift, with nothing directing it.
      const lessonA = course.modules[0]!.lessons[0]!;
      const afterA = await engine.refineCurriculum(course.id, [
        { op: "regenerate", nodeId: lessonA.id },
      ]);
      const regeneratedA = findLesson(afterA, lessonA.id);
      logBeforeAfter("no instruction", lessonA, regeneratedA);

      // Case B — a real, clearly-redirecting instruction on a DIFFERENT lesson (so this
      // isn't contaminated by case A's edit). A near-synonym title/objectives here would
      // mean the instruction isn't actually steering content — that's the thing we're
      // trying to observe, not just "did the title change at all."
      const lessonB = course.modules[1]!.lessons[0]!;
      const afterB = await engine.refineCurriculum(afterA.id, [
        {
          op: "regenerate",
          nodeId: lessonB.id,
          instruction:
            "refocus this lesson entirely on cross-border/international hiring — visa sponsorship, remote-work compliance across countries, and cross-cultural interviewing — move away from any domestic-only framing",
        },
      ]);
      const regeneratedB = findLesson(afterB, lessonB.id);
      logBeforeAfter("clear instruction", lessonB, regeneratedB);

      // Weak sanity checks only — whether the redirect is REAL is a judgment call made by
      // reading the before/after output above, not something a string-inequality assert
      // can capture (a one-word change satisfies `.not.toBe()` just as well as a genuine
      // redirect would).
      expect(regeneratedA.title).not.toBe(lessonA.title);
      expect(regeneratedB.title).not.toBe(lessonB.title);
      expect(afterB.status).toBe("draft");

      // Gate: forbidden pre-approval, permitted post-approval (ADR 0004 / ADR 0009).
      const style: StyleProfile = {
        practitionerId: "p-live-refine",
        modalities: ["textual"],
        tone: "plain",
        depth: "working",
      };
      await expect(
        engine.generateArtefacts(afterB.id, ["textual"], style),
      ).rejects.toThrow(/validated/);

      const approved = await engine.approveCurriculum(afterB.id);
      expect(approved.status).toBe("validated");

      const artefacts = await engine.generateArtefacts(
        approved.id,
        ["textual"],
        style,
      );
      expect(artefacts).toHaveLength(1);
    }, 120_000);
  },
);
