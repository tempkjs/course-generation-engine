// Documented live-mode check for the HR field. Skipped unless AI_MODE=live — run with:
// ANTHROPIC_API_KEY=... AI_MODE=live pnpm vitest run tests/live.employee-relations.test.ts
//
// The FIRST run of this file (no jurisdiction — that field didn't exist yet) exposed two
// things at once: the JSON-envelope-leak bug (fixed, ADR 0017 packet) and content that
// defaulted to US law (Title VII, ADA, ADEA, FMLA, NLRA, EEOC) for an Indian HR audience,
// because the engine had no jurisdiction anchor at all (ADR 0018, contract v0.7). That
// capture was promoted to fixtures/artefacts.v2/employee-relations.json — now stale.
//
// THIS run adds `jurisdiction: "IN"` and is the ONE live run ADR 0018 requires (an upstream
// prompt-behaviour change — a fixture cannot substitute, per ADR 0017 rule 3). Its output is
// promoted to fixtures/artefacts.v3/employee-relations.json, replacing the stale v2 capture.
import { describe, it, expect } from "vitest";
import { getArtefactContent, getCourseEngine } from "@/modules/engine/server";
import { buildVerificationChecklist } from "@/modules/engine";
import { getUsageTotals, resetUsageTotals } from "@/modules/llm";
import {
  createValidationLog,
  type ValidationLog,
} from "./support/validationLog";
import type { Artefact, Course, Module, StyleProfile } from "@/contracts";

const isLive = process.env.AI_MODE === "live";

/** Lesson "1.2" — module order 1, lesson order 2 — the exact lesson the bug report named. */
function findLessonOneTwo(course: Course) {
  const module1 = course.modules.find((m: Module) => m.order === 1);
  if (!module1) throw new Error("No module with order 1");
  const lesson2 = module1.lessons.find((l) => l.order === 2);
  if (!lesson2)
    throw new Error(`Module 1 ("${module1.title}") has no lesson order 2`);
  return { module: module1, lesson: lesson2 };
}

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
  "CourseEngine (AI_MODE=live) — Employee Relations lesson 1.2",
  () => {
    it(
      "generates textual + slide artefacts for lesson 1.2",
      async () => {
        const runStart = Date.now();
        const validationLog = createValidationLog("live-employee-relations");
        const { log, path } = validationLog;
        resetUsageTotals();
        const engine = getCourseEngine();

        const style: StyleProfile = {
          practitionerId: "p-live-employee-relations",
          modalities: ["textual", "slide"],
          tone: "plain",
          depth: "working",
        };

        const draft = await engine.generateCurriculum({
          topic: "Employee Relations",
          field: "hr",
          jurisdiction: "IN", // ADR 0018 — the failing case: was silently US-law before this
          level: "medium",
          audienceExperience: "",
          durationWeeks: 5,
          cadence: "weekend-2x2",
          practitionerId: "p-live-employee-relations",
          style,
        });
        expect(draft.status).toBe("draft");
        expect(draft.jurisdiction).toBe("IN");

        log(
          `\n=== CURRICULUM: "${draft.title}" (field: ${draft.field}, jurisdiction: ${draft.jurisdiction}) ===`,
        );
        for (const module of draft.modules) {
          log(`\nModule ${module.order}: ${module.title}`);
          for (const lesson of module.lessons) {
            log(`  Lesson ${lesson.order}: ${lesson.title}`);
          }
        }

        const { lesson: lessonOneTwo } = findLessonOneTwo(draft);
        log(
          `\n=== TARGET LESSON 1.2: "${lessonOneTwo.title}" ===\nObjectives: ${JSON.stringify(lessonOneTwo.objectives)}`,
        );

        const approved = await engine.approveCurriculum(draft.id);
        expect(approved.status).toBe("validated");

        const artefacts = await engine.generateArtefacts(
          approved.id,
          ["textual", "slide"],
          style,
          { lessonIds: [lessonOneTwo.id] },
        );
        expect(artefacts).toHaveLength(2);

        for (const artefact of artefacts) {
          const content = getArtefactContent(artefact.contentRef) ?? "";
          log(
            `\n=== ARTEFACT — "${lessonOneTwo.title}" — ${artefact.type} ===\n${content}`,
          );
          logFlaggedClaims(validationLog, artefact.type, artefact);

          // ADR 0018's actual motivating bug: US statutes generated for an Indian audience.
          // A regression here means jurisdiction grounding silently stopped working.
          expect(content).not.toMatch(
            /Title VII|Americans with Disabilities Act|Age Discrimination in Employment Act|Family and Medical Leave Act|National Labor Relations Act|\bEEOC\b/,
          );
        }

        const checklist = buildVerificationChecklist(artefacts);
        log(
          `\n=== VERIFICATION CHECKLIST — lesson 1.2 (${checklist.totalClaims} claims) ===`,
        );
        log(`By type: ${JSON.stringify(checklist.byType)}`);

        const elapsedSeconds = ((Date.now() - runStart) / 1000).toFixed(1);
        const usage = getUsageTotals();
        log(
          `\n=== live run summary: ${elapsedSeconds}s wall-clock; 1 curriculum call + 2 artefact-content calls (textual, slide) for lesson 1.2 only = 3 total LLM calls ===`,
        );
        log(
          `\n=== usage: ${usage.calls} calls, ${usage.inputTokens} input tokens, ${usage.outputTokens} output tokens ===`,
        );
        log(`\n=== validation output written to: ${path} ===`);
      },
      5 * 60 * 1000, // matches live.ca-gst's ceiling — a genuine hang still fails loudly well
      // before this, since the real call count here is only 3 (curriculum + 2 artefact calls).
    );
  },
);
