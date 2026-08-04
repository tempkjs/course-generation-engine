// Documented live-mode check (milestone 3 DoD). Skipped unless AI_MODE=live — run with:
//   ANTHROPIC_API_KEY=... pnpm test:live
import { describe, it, expect } from "vitest";
import {
  getArtefactContent,
  getCourse,
  getCourseEngine,
} from "@/modules/engine/server";
import type { ArtefactType, StyleProfile } from "@/contracts";

const isLive = process.env.AI_MODE === "live";

/**
 * Reads back the MOST RECENTLY generated artefact of `type` for `lessonId`, via the
 * server-barrel peeks into the Seam-4 mock stores (ADR 0011) — generateArtefacts itself only
 * returns Artefact[] (contentRef pointers), so this is the only way to inspect what actually
 * got attached/stored.
 */
function latestArtefactContent(
  courseId: string,
  lessonId: string,
  type: ArtefactType,
): string {
  const course = getCourse(courseId)!;
  const lesson = course.modules
    .flatMap((m) => m.lessons)
    .find((l) => l.id === lessonId)!;
  const matches = lesson.artefacts.filter((a) => a.type === type);
  const latest = matches[matches.length - 1]!;
  return getArtefactContent(latest.contentRef) ?? "";
}

describe.skipIf(!isLive)(
  "CourseEngine (AI_MODE=live) — Phase 2 artefact generation",
  () => {
    it("generates real, style-conditioned textual + slide content for a lesson, and a visible style contrast on the SAME lesson", async () => {
      const engine = getCourseEngine();
      const draft = await engine.generateCurriculum({
        topic: "Giving Effective Feedback",
        field: "hr",
        level: "basic",
        audienceExperience: "first-time people manager",
        durationWeeks: 1,
        cadence: "weekend-2x2",
        practitionerId: "p-live-artefacts",
        style: {
          practitionerId: "p-live-artefacts",
          modalities: ["textual", "slide"],
          tone: "plain",
          depth: "working",
        },
      });
      const approved = await engine.approveCurriculum(draft.id);
      expect(approved.status).toBe("validated");

      const lessonId = approved.modules[0]!.lessons[0]!.id;

      // Case A — textual + slide, for every lesson (small course, durationWeeks: 1).
      const styleA: StyleProfile = {
        practitionerId: "p-live-artefacts",
        modalities: ["textual", "slide"],
        tone: "plain",
        depth: "overview",
      };
      const artefactsA = await engine.generateArtefacts(
        approved.id,
        ["textual", "slide"],
        styleA,
      );
      expect(artefactsA.length).toBeGreaterThan(0);
      for (const artefact of artefactsA) {
        expect(artefact.contentRef.length).toBeGreaterThan(0);
        expect(artefact.approved).toBe(false);
      }

      const textualA = latestArtefactContent(approved.id, lessonId, "textual");
      const slideA = latestArtefactContent(approved.id, lessonId, "slide");

      /* eslint-disable no-console -- diagnostic output for the manual read-through */
      console.log(
        `\n=== textual — style A (plain / overview) ===\n${textualA}`,
      );
      console.log(`\n=== slide — style A (plain / overview) ===\n${slideA}`);
      /* eslint-enable no-console */

      expect(textualA.length).toBeGreaterThan(0);
      expect(slideA.length).toBeGreaterThan(0);

      // Case B — the SAME lesson, a deliberately contrasting style: tone rigorous, depth
      // deep, vs. plain/overview above. Whether the contrast is REAL is a human read of the
      // printed output above and below, not something an assertion can judge — the checks
      // here stay weak (content changed at all) on purpose.
      const styleB: StyleProfile = {
        practitionerId: "p-live-artefacts",
        modalities: ["textual", "slide"],
        tone: "rigorous",
        depth: "deep",
      };
      await engine.generateArtefacts(approved.id, ["textual"], styleB);
      const textualB = latestArtefactContent(approved.id, lessonId, "textual");

      // eslint-disable-next-line no-console -- diagnostic output for the manual read-through
      console.log(`\n=== textual — style B (rigorous / deep) ===\n${textualB}`);

      expect(textualB).not.toBe(textualA);
    }, 180_000);
  },
);
