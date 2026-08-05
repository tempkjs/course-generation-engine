// Documented live-mode check (milestone 2 DoD). Skipped unless AI_MODE=live — run with:
//   ANTHROPIC_API_KEY=... pnpm test:live
import { describe, it, expect } from "vitest";
import { getCourseEngine } from "@/modules/engine/server";
import { getUsageTotals, resetUsageTotals } from "@/modules/llm";
import {
  createValidationLog,
  type ValidationLog,
} from "./support/validationLog";
import type { Course, Lesson, StyleProfile } from "@/contracts";

const isLive = process.env.AI_MODE === "live";

function findLesson(course: Course, lessonId: string): Lesson {
  for (const m of course.modules) {
    const lesson = m.lessons.find((l) => l.id === lessonId);
    if (lesson) return lesson;
  }
  throw new Error(`lesson ${lessonId} not found in course ${course.id}`);
}

function logBeforeAfter(
  { log }: ValidationLog,
  label: string,
  before: Lesson,
  after: Lesson,
): void {
  log(`\n=== ${label} — BEFORE ===`);
  log(`title: "${before.title}"`);
  log(`objectives: ${JSON.stringify(before.objectives)}`);
  log(`=== ${label} — AFTER ===`);
  log(`title: "${after.title}"`);
  log(`objectives: ${JSON.stringify(after.objectives)}`);
}

describe.skipIf(!isLive)(
  "CourseEngine (AI_MODE=live) — refine loop + approval gate",
  () => {
    it("regenerate: no instruction drifts minorly, a clear instruction actually redirects the lesson", async () => {
      const validationLog = createValidationLog("live-refine");
      resetUsageTotals();
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
      logBeforeAfter(validationLog, "no instruction", lessonA, regeneratedA);

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
      logBeforeAfter(validationLog, "clear instruction", lessonB, regeneratedB);

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

      // Whole-course generateArtefacts (no opts.lessonIds) — one textual artefact per
      // lesson in the course, not necessarily 1 (that was a stale assumption from before
      // M3's per-lesson generation; see ADR 0014 for the lesson-scoped alternative).
      const artefacts = await engine.generateArtefacts(
        approved.id,
        ["textual"],
        style,
      );
      expect(artefacts.length).toBeGreaterThan(0);
      expect(artefacts.every((a) => a.type === "textual")).toBe(true);

      const usage = getUsageTotals();
      validationLog.log(
        `\n=== usage: ${usage.calls} calls, ${usage.inputTokens} input tokens, ${usage.outputTokens} output tokens ===`,
      );
      validationLog.log(
        `\n=== validation output written to: ${validationLog.path} ===`,
      );
    }, 120_000);
  },
);
