// Documented live-mode check AND first CA-domain substrate seed. Skipped unless AI_MODE=live
// — run with: ANTHROPIC_API_KEY=... pnpm test:live
//
// This test serves two purposes at once: (a) it's a real-content validation of Phase 1
// (curriculum) and Phase 2 (style-conditioned artefacts) for a genuine field ("ca") the mock
// suite never exercises, and (b) its printed curriculum tree IS the first CA-domain substrate
// seed for the architect to read and curate. Printing here writes nothing to any cache —
// KnowledgeWriter/Seam 3 is untouched; the cache stays read-mostly/curated per ADR 0005. The
// architect decides by hand whether/how this becomes a real KnowledgeUnit.
//
// LESSON-SCOPING NOTE (see ADR 0012's "related finding"): generateArtefacts(courseId, prefs,
// style) has no lessonId parameter — it generates for EVERY lesson in the course, each call.
// A first version of this test called it directly on the full 6-module/24-lesson curriculum
// and fanned out to ~48 real calls, which is what surfaced the need for ADR 0012's retry
// policy in the first place. To validate Phase 2 for just the ONE lesson the architect asked
// about without either (a) paying for 48 calls again or (b) widening Seam 1 to add lesson
// scoping (not this test's call to make), we trim the approved course down to exactly one
// module / one lesson using the EXISTING refineCurriculum 'remove' op (structural, no LLM,
// already part of the contract) before approving. generateArtefacts then only has one lesson
// to generate for, honestly, through the real interface — not a special-cased shortcut.
import { describe, it, expect } from "vitest";
import {
  getArtefactContent,
  getCourse,
  getCourseEngine,
} from "@/modules/engine/server";
import type {
  ArtefactType,
  Course,
  Edit,
  Module,
  StyleProfile,
} from "@/contracts";

const isLive = process.env.AI_MODE === "live";

function printCurriculum(course: Course): void {
  /* eslint-disable no-console -- this printed tree IS the substrate seed output */
  console.log(
    `\n=== CURRICULUM: "${course.title}" (field: ${course.field}, level: ${course.level}, status: ${course.status}) ===`,
  );
  for (const module of course.modules) {
    console.log(`\nModule ${module.order}: ${module.title}`);
    console.log(`  Summary: ${module.summary}`);
    for (const lesson of module.lessons) {
      console.log(
        `  Lesson ${lesson.order} [${lesson.delivery}]: ${lesson.title}`,
      );
      console.log(`    Objectives: ${JSON.stringify(lesson.objectives)}`);
    }
  }
  /* eslint-enable no-console */
}

function findModuleByTitleHint(course: Course, hints: string[]): Module {
  const found = course.modules.find((m) =>
    hints.some((hint) => m.title.toLowerCase().includes(hint.toLowerCase())),
  );
  if (!found) {
    throw new Error(
      `No module title contains any of [${hints.join(", ")}] — got: ${course.modules.map((m) => m.title).join(", ")}`,
    );
  }
  return found;
}

/** Reads back the most recently generated artefact of `type` for `lessonId` (ADR 0011). */
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
  "CourseEngine (AI_MODE=live) — CA/GST curriculum: substrate seed + Phase 1+2 validation",
  () => {
    it(
      "generates a practitioner-shaped GST curriculum, steers it via refine, and generates style-conditioned artefacts for the ITC lesson",
      async () => {
        const runStart = Date.now();
        const engine = getCourseEngine();

        // ---- 1. Curriculum (the substrate seed) ------------------------------------
        const draft = await engine.generateCurriculum({
          topic: "GST Practical Implementation for Chartered Accountants",
          field: "ca",
          level: "medium",
          audienceExperience:
            "Qualified Chartered Accountants, 0-5 years post-qualification experience, " +
            "early practice. This is a practitioner workflow course, not exam-prep or " +
            "'what is GST' theory — structure it as a practitioner ladder covering things " +
            "like GST on ERP systems, return filing, ITC reconciliation, e-invoicing, " +
            "handling GST notices, and GST audits.",
          durationWeeks: 6,
          cadence: "weekend-2x2",
          practitionerId: "p-live-ca-gst",
          style: {
            practitionerId: "p-live-ca-gst",
            modalities: ["textual", "slide"],
            tone: "professional, precise, practitioner-to-practitioner",
            depth: "working",
          },
        });
        expect(draft.status).toBe("draft");
        expect(draft.modules.length).toBeGreaterThan(0);
        printCurriculum(draft);

        // ---- 2. Refine — a real instruction on the ITC module, to confirm CA-domain
        // steering actually works, not just Phase-1 generation. -----------------------
        const itcModule = findModuleByTitleHint(draft, [
          "ITC",
          "Input Tax Credit",
        ]);
        const refined = await engine.refineCurriculum(draft.id, [
          {
            op: "regenerate",
            nodeId: itcModule.id,
            instruction:
              "focus on ITC reconciliation against GSTR-2B and common mismatch scenarios in practice",
          },
        ]);
        const regeneratedItc = refined.modules.find(
          (m) => m.id === itcModule.id,
        )!;

        /* eslint-disable no-console -- diagnostic output for the manual before/after read */
        console.log(`\n=== REFINE — ITC module — BEFORE ===`);
        console.log(`Title: "${itcModule.title}"`);
        console.log(`Summary: ${itcModule.summary}`);
        console.log(`\n=== REFINE — ITC module — AFTER ===`);
        console.log(`Title: "${regeneratedItc.title}"`);
        console.log(`Summary: ${regeneratedItc.summary}`);
        /* eslint-enable no-console */

        expect(regeneratedItc.title.length).toBeGreaterThan(0);
        expect(refined.status).toBe("draft");

        // ---- 3. Trim to ONE lesson before approving — see the lesson-scoping note at the
        // top of this file. Still status 'draft', so refineCurriculum's structural 'remove'
        // op (existing contract, no LLM) is permitted. Every module except the ITC one, and
        // every lesson in the ITC module except its first, gets removed.
        const targetLessonId = regeneratedItc.lessons[0]!.id;
        const trimEdits: Edit[] = [
          ...refined.modules
            .filter((m) => m.id !== itcModule.id)
            .map((m): Edit => ({ op: "remove", nodeId: m.id })),
          ...regeneratedItc.lessons
            .filter((l) => l.id !== targetLessonId)
            .map((l): Edit => ({ op: "remove", nodeId: l.id })),
        ];
        const trimmed = await engine.refineCurriculum(refined.id, trimEdits);
        expect(trimmed.modules).toHaveLength(1);
        expect(trimmed.modules[0]!.lessons).toHaveLength(1);
        const targetLesson = trimmed.modules[0]!.lessons[0]!;

        // eslint-disable-next-line no-console
        console.log(
          `\n=== trimmed to 1 module / 1 lesson for Phase-2 validation: "${targetLesson.title}" ===`,
        );

        // ---- 4. Approve, then generate Phase-2 artefacts for the (now sole) ITC lesson
        // under two different StyleProfiles — ~4 real calls total (2 types x 2 styles), not
        // ~48, because the course now has exactly one lesson. ---------------------------
        const approved = await engine.approveCurriculum(trimmed.id);
        expect(approved.status).toBe("validated");

        const styleA: StyleProfile = {
          practitionerId: "p-live-ca-gst",
          modalities: ["textual", "slide"],
          tone: "plain",
          depth: "overview",
        };
        const artefactsA = await engine.generateArtefacts(
          approved.id,
          ["textual", "slide"],
          styleA,
        );
        expect(artefactsA).toHaveLength(2); // exactly this lesson x {textual, slide}

        const textualA = latestArtefactContent(
          approved.id,
          targetLesson.id,
          "textual",
        );
        const slideA = latestArtefactContent(
          approved.id,
          targetLesson.id,
          "slide",
        );

        /* eslint-disable no-console -- this printed content IS the artefact-quality signal */
        console.log(
          `\n=== ARTEFACT — "${targetLesson.title}" — textual — style A (plain / overview) ===\n${textualA}`,
        );
        console.log(
          `\n=== ARTEFACT — "${targetLesson.title}" — slide — style A (plain / overview) ===\n${slideA}`,
        );
        /* eslint-enable no-console */

        expect(textualA.length).toBeGreaterThan(0);
        expect(slideA.length).toBeGreaterThan(0);

        const styleB: StyleProfile = {
          practitionerId: "p-live-ca-gst",
          modalities: ["textual", "slide"],
          tone: "rigorous",
          depth: "deep",
        };
        const artefactsB = await engine.generateArtefacts(
          approved.id,
          ["textual", "slide"],
          styleB,
        );
        expect(artefactsB).toHaveLength(2);

        const textualB = latestArtefactContent(
          approved.id,
          targetLesson.id,
          "textual",
        );
        const slideB = latestArtefactContent(
          approved.id,
          targetLesson.id,
          "slide",
        );

        /* eslint-disable no-console -- this printed content IS the artefact-quality signal */
        console.log(
          `\n=== ARTEFACT — "${targetLesson.title}" — textual — style B (rigorous / deep) ===\n${textualB}`,
        );
        console.log(
          `\n=== ARTEFACT — "${targetLesson.title}" — slide — style B (rigorous / deep) ===\n${slideB}`,
        );
        /* eslint-enable no-console */

        expect(textualB.length).toBeGreaterThan(0);
        expect(slideB.length).toBeGreaterThan(0);
        expect(textualB).not.toBe(textualA);
        expect(slideB).not.toBe(slideA);

        const elapsedSeconds = ((Date.now() - runStart) / 1000).toFixed(1);
        // eslint-disable-next-line no-console
        console.log(
          `\n=== live run summary: ${elapsedSeconds}s wall-clock; 1 curriculum call + 1 refine/regenerate call + 0 LLM calls to trim (structural) + 4 artefact-content calls (2 for style A, 2 for style B, on 1 lesson) = 6 total LLM calls ===`,
        );
      },
      5 * 60 * 1000, // 5 min — a genuine hang now fails loudly well before the old 20 min
      // ceiling, since the real call count dropped from ~50 to ~6.
    );
  },
);
