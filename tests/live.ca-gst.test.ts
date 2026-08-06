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
// LESSON SCOPING: an earlier version of this test had no way to target just the ITC lesson
// (generateArtefacts generated for every lesson in the course, ~48 calls for this 24-lesson
// curriculum) and worked around it by destructively trimming the course down to one module/
// lesson via 'remove' edits. ADR 0014 (contract v0.5) closed that gap properly — generateArtefacts
// now takes an optional opts.lessonIds — so this test targets the ITC lesson directly on the
// full, untrimmed, approved curriculum. No workaround, no destructive edit.
import { describe, it, expect } from "vitest";
import {
  getArtefactContent,
  getCourse,
  getCourseEngine,
} from "@/modules/engine/server";
import { buildVerificationChecklist } from "@/modules/engine";
import { getUsageTotals, resetUsageTotals } from "@/modules/llm";
import {
  createValidationLog,
  type ValidationLog,
} from "./support/validationLog";
import type {
  Artefact,
  ArtefactType,
  Course,
  Module,
  StyleProfile,
} from "@/contracts";

const isLive = process.env.AI_MODE === "live";

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

/** Prints an artefact's flaggedClaims (ADR 0013) — the in-generation verification worklist. */
function logFlaggedClaims(
  { log }: ValidationLog,
  label: string,
  artefact: Artefact,
): void {
  log(`\n=== FLAGGED CLAIMS — ${label} (${artefact.flaggedClaims.length}) ===`);
  for (const claim of artefact.flaggedClaims) {
    log(
      `  [${claim.type}] "${claim.text}"${claim.note ? ` — ${claim.note}` : ""}`,
    );
  }
}

describe.skipIf(!isLive)(
  "CourseEngine (AI_MODE=live) — CA/GST curriculum: substrate seed + Phase 1+2 validation",
  () => {
    it(
      "generates a practitioner-shaped GST curriculum, steers it via refine, and generates style-conditioned artefacts for the ITC lesson",
      async () => {
        const runStart = Date.now();
        const validationLog = createValidationLog("live-ca-gst");
        const { log, path } = validationLog;
        resetUsageTotals();
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

        log(
          `\n=== CURRICULUM: "${draft.title}" (field: ${draft.field}, level: ${draft.level}, status: ${draft.status}) ===`,
        );
        for (const module of draft.modules) {
          log(`\nModule ${module.order}: ${module.title}`);
          log(`  Summary: ${module.summary}`);
          for (const lesson of module.lessons) {
            log(
              `  Lesson ${lesson.order} [${lesson.delivery}]: ${lesson.title}`,
            );
            log(`    Objectives: ${JSON.stringify(lesson.objectives)}`);
          }
        }

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

        log(`\n=== REFINE — ITC module — BEFORE ===`);
        log(`Title: "${itcModule.title}"`);
        log(`Summary: ${itcModule.summary}`);
        log(`\n=== REFINE — ITC module — AFTER ===`);
        log(`Title: "${regeneratedItc.title}"`);
        log(`Summary: ${regeneratedItc.summary}`);

        expect(regeneratedItc.title.length).toBeGreaterThan(0);
        expect(refined.status).toBe("draft");

        // ---- 3. Approve the FULL curriculum — no trimming (ADR 0014). ------------------
        const approved = await engine.approveCurriculum(refined.id);
        expect(approved.status).toBe("validated");

        const itcModuleApproved = approved.modules.find(
          (m) => m.id === itcModule.id,
        )!;
        const targetLesson = itcModuleApproved.lessons[0]!;

        // ---- 4. Generate Phase-2 artefacts for JUST the ITC lesson, under two different
        // StyleProfiles — opts.lessonIds scopes generateArtefacts to exactly this lesson,
        // so this is ~4 real calls (2 types x 2 styles), not ~48 for the whole course.
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
          { lessonIds: [targetLesson.id] },
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

        log(
          `\n=== ARTEFACT — "${targetLesson.title}" — textual — style A (plain / overview) ===\n${textualA}`,
        );
        log(
          `\n=== ARTEFACT — "${targetLesson.title}" — slide — style A (plain / overview) ===\n${slideA}`,
        );
        logFlaggedClaims(
          validationLog,
          "textual, style A",
          artefactsA.find((a) => a.type === "textual")!,
        );
        logFlaggedClaims(
          validationLog,
          "slide, style A",
          artefactsA.find((a) => a.type === "slide")!,
        );

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
          { lessonIds: [targetLesson.id] },
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

        log(
          `\n=== ARTEFACT — "${targetLesson.title}" — textual — style B (rigorous / deep) ===\n${textualB}`,
        );
        log(
          `\n=== ARTEFACT — "${targetLesson.title}" — slide — style B (rigorous / deep) ===\n${slideB}`,
        );
        logFlaggedClaims(
          validationLog,
          "textual, style B",
          artefactsB.find((a) => a.type === "textual")!,
        );
        logFlaggedClaims(
          validationLog,
          "slide, style B",
          artefactsB.find((a) => a.type === "slide")!,
        );

        expect(textualB.length).toBeGreaterThan(0);
        expect(slideB.length).toBeGreaterThan(0);
        expect(textualB).not.toBe(textualA);
        expect(slideB).not.toBe(slideA);

        // At least one real, attributable non-static claim (a citation, date, figure, ...)
        // is expected for real GST reference material — a completely empty flag list across
        // all four artefacts would itself be a signal something's wrong with Decision 1.
        const allArtefacts = [...artefactsA, ...artefactsB];
        const checklist = buildVerificationChecklist(allArtefacts);
        expect(checklist.totalClaims).toBeGreaterThan(0);

        log(
          `\n=== VERIFICATION CHECKLIST — ITC lesson, all 4 artefacts (${checklist.totalClaims} claims) ===`,
        );
        log(`By type: ${JSON.stringify(checklist.byType)}`);

        const elapsedSeconds = ((Date.now() - runStart) / 1000).toFixed(1);
        const usage = getUsageTotals();
        log(
          `\n=== live run summary: ${elapsedSeconds}s wall-clock; 1 curriculum call + 1 refine/regenerate call + 4 artefact-content calls (2 for style A, 2 for style B, lesson-scoped to the ITC lesson only, ADR 0014) = 6 total LLM calls ===`,
        );
        log(
          `\n=== usage: ${usage.calls} calls, ${usage.inputTokens} input tokens, ${usage.outputTokens} output tokens ===`,
        );
        log(`\n=== validation output written to: ${path} ===`);
      },
      5 * 60 * 1000, // 5 min — a genuine hang fails loudly well before this ceiling, since
      // the real call count is ~6 (curriculum + refine + 4 lesson-scoped artefact calls).
    );
  },
);
