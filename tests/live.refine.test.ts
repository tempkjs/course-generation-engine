// Documented live-mode check (milestone 2 DoD). Skipped unless AI_MODE=live — run with:
//   ANTHROPIC_API_KEY=... pnpm test:live
import { describe, it, expect } from "vitest";
import { getCourseEngine } from "@/modules/engine/server";
import type { StyleProfile } from "@/contracts";

const isLive = process.env.AI_MODE === "live";

describe.skipIf(!isLive)(
  "CourseEngine (AI_MODE=live) — refine loop + approval gate",
  () => {
    it("regenerate produces a visibly different, field-appropriate module; approve opens the gate", async () => {
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
      const targetModule = course.modules[0]!;

      const refined = await engine.refineCurriculum(course.id, [
        {
          op: "regenerate",
          nodeId: targetModule.id,
          instruction: "reframe around structured interviewing",
        },
      ]);
      const regenerated = refined.modules.find(
        (m) => m.id === targetModule.id,
      )!;

      /* eslint-disable no-console -- diagnostic output for the manual before/after check */
      console.log(`\n=== before: "${targetModule.title}" ===`);
      console.log(`=== after:  "${regenerated.title}" ===`);
      /* eslint-enable no-console */

      expect(regenerated.title).not.toBe(targetModule.title);
      expect(refined.status).toBe("draft");

      // Gate: forbidden pre-approval, permitted post-approval (ADR 0004 / ADR 0009).
      const style: StyleProfile = {
        practitionerId: "p-live-refine",
        modalities: ["textual"],
        tone: "plain",
        depth: "working",
      };
      await expect(
        engine.generateArtefacts(refined.id, ["textual"], style),
      ).rejects.toThrow(/validated/);

      const approved = await engine.approveCurriculum(refined.id);
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
