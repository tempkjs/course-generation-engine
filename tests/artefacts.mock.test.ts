import "./support/forceMockMode";
import { describe, it, expect } from "vitest";
import {
  getArtefactContent,
  getCourse,
  getCourseEngine,
} from "@/modules/engine/server";
import { buildVerificationChecklist } from "@/modules/engine";
import type {
  Course,
  CourseEngine,
  GenerateRequest,
  StyleProfile,
} from "@/contracts";

function req(topic: string): GenerateRequest {
  return {
    topic,
    field: "software",
    level: "medium",
    audienceExperience: "",
    durationWeeks: 5,
    cadence: "weekend-2x2",
    practitionerId: "p",
    style: {
      practitionerId: "p",
      modalities: ["textual"],
      tone: "plain",
      depth: "working",
    },
  };
}

const style: StyleProfile = {
  practitionerId: "p",
  modalities: ["textual", "slide"],
  tone: "plain",
  depth: "working",
};

async function approvedCourse(
  topic: string,
): Promise<{ engine: CourseEngine; approved: Course }> {
  const engine = getCourseEngine();
  const draft = await engine.generateCurriculum(req(topic));
  const approved = await engine.approveCurriculum(draft.id);
  return { engine, approved };
}

function lessonCountOf(course: Course): number {
  return course.modules.reduce((n, m) => n + m.lessons.length, 0);
}

describe("generateArtefacts (AI_MODE=mock)", () => {
  it("throws before approval, succeeds after (ADR 0004 gate)", async () => {
    const engine = getCourseEngine();
    const c = await engine.generateCurriculum(req("artefacts-gate"));

    await expect(
      engine.generateArtefacts(c.id, ["textual"], style),
    ).rejects.toThrow(/validated/);

    await engine.approveCurriculum(c.id);
    const artefacts = await engine.generateArtefacts(c.id, ["textual"], style);
    expect(artefacts.length).toBeGreaterThan(0);
  });

  it("generates one artefact per (lesson x requested type), attached to the right lesson", async () => {
    const { engine, approved } = await approvedCourse("artefacts-shape");
    const lessonCount = lessonCountOf(approved);

    const artefacts = await engine.generateArtefacts(
      approved.id,
      ["textual", "slide"],
      style,
    );
    expect(artefacts).toHaveLength(lessonCount * 2);

    // generateArtefacts returns Artefact[] only (contentRef pointers, no lessonId — the
    // contract has no such field). Attachment can only be verified via the persisted course.
    const persisted = getCourse(approved.id)!;
    for (const module of persisted.modules) {
      for (const lesson of module.lessons) {
        expect(lesson.artefacts.map((a) => a.type).sort()).toEqual([
          "slide",
          "textual",
        ]);
      }
    }
  });

  it("populates contentRef, pointing at real stored content, for every generated artefact", async () => {
    const { engine, approved } = await approvedCourse("artefacts-content-ref");
    const artefacts = await engine.generateArtefacts(
      approved.id,
      ["textual"],
      style,
    );
    expect(artefacts.length).toBeGreaterThan(0);
    for (const artefact of artefacts) {
      expect(artefact.contentRef.length).toBeGreaterThan(0);
      expect(getArtefactContent(artefact.contentRef)).toBeTruthy();
      expect(artefact.approved).toBe(false);
    }
  });

  it("only generates the requested types — a not-requested type is absent", async () => {
    const { engine, approved } = await approvedCourse("artefacts-prefs");
    const artefacts = await engine.generateArtefacts(
      approved.id,
      ["textual"],
      style,
    );
    expect(artefacts.every((a) => a.type === "textual")).toBe(true);
    expect(artefacts.some((a) => a.type === "slide")).toBe(false);
  });

  it("returns a clearly-marked stub for a not-yet-supported type, without throwing", async () => {
    const { engine, approved } = await approvedCourse("artefacts-stub-type");
    const artefacts = await engine.generateArtefacts(
      approved.id,
      ["quiz"],
      style,
    );
    expect(artefacts.length).toBeGreaterThan(0);
    for (const artefact of artefacts) {
      expect(artefact.type).toBe("quiz");
      expect(getArtefactContent(artefact.contentRef)).toMatch(
        /not yet supported/i,
      );
    }
  });

  it("opts.lessonIds scopes generation to just those lessons (ADR 0014)", async () => {
    const { engine, approved } = await approvedCourse("artefacts-lesson-scope");
    const lessonCount = lessonCountOf(approved);
    expect(lessonCount).toBeGreaterThan(1); // otherwise this test proves nothing

    const targetLesson = approved.modules[0]!.lessons[0]!;
    const artefacts = await engine.generateArtefacts(
      approved.id,
      ["textual", "slide"],
      style,
      { lessonIds: [targetLesson.id] },
    );
    expect(artefacts).toHaveLength(2); // exactly this lesson x {textual, slide}

    const persisted = getCourse(approved.id)!;
    for (const module of persisted.modules) {
      for (const lesson of module.lessons) {
        if (lesson.id === targetLesson.id) {
          expect(lesson.artefacts.map((a) => a.type).sort()).toEqual([
            "slide",
            "textual",
          ]);
        } else {
          expect(lesson.artefacts).toHaveLength(0);
        }
      }
    }
  });

  it("opts.lessonIds omitted still targets every lesson (unchanged default)", async () => {
    const { engine, approved } = await approvedCourse(
      "artefacts-lesson-scope-omitted",
    );
    const lessonCount = lessonCountOf(approved);

    const artefacts = await engine.generateArtefacts(
      approved.id,
      ["textual"],
      style,
    );
    expect(artefacts).toHaveLength(lessonCount);
  });

  it("opts.lessonIds === [] is a caller error, not a silent no-op", async () => {
    const { engine, approved } = await approvedCourse("artefacts-empty-scope");

    await expect(
      engine.generateArtefacts(approved.id, ["textual"], style, {
        lessonIds: [],
      }),
    ).rejects.toThrow(/lessonIds/);
  });

  it("every generated artefact carries flaggedClaims (ADR 0013)", async () => {
    const { engine, approved } = await approvedCourse("artefacts-flags");
    const artefacts = await engine.generateArtefacts(
      approved.id,
      ["textual", "slide"],
      style,
    );
    expect(artefacts.length).toBeGreaterThan(0);
    for (const artefact of artefacts) {
      expect(Array.isArray(artefact.flaggedClaims)).toBe(true);
      // MockLlmProvider's response is never a parseable artefacts.v2 envelope, so the
      // defensive fallback in parseArtefactResponse fires deterministically every time —
      // exercising the flaggedClaims path end to end without a real model in the loop.
      expect(artefact.flaggedClaims.length).toBeGreaterThan(0);
      for (const claim of artefact.flaggedClaims) {
        expect(claim.text.length).toBeGreaterThan(0);
      }
    }
  });

  it("a not-yet-supported stub type has no flaggedClaims (nothing was actually generated)", async () => {
    const { engine, approved } = await approvedCourse(
      "artefacts-flags-stub-type",
    );
    const artefacts = await engine.generateArtefacts(
      approved.id,
      ["quiz"],
      style,
    );
    for (const artefact of artefacts) {
      expect(artefact.flaggedClaims).toEqual([]);
    }
  });

  it("buildVerificationChecklist aggregates flaggedClaims across every lesson's artefacts", async () => {
    const { engine, approved } = await approvedCourse("artefacts-checklist");
    const lessonCount = lessonCountOf(approved);
    expect(lessonCount).toBeGreaterThan(1); // otherwise aggregation proves nothing

    const artefacts = await engine.generateArtefacts(
      approved.id,
      ["textual", "slide"],
      style,
    );
    const checklist = buildVerificationChecklist(artefacts);

    const expectedTotal = artefacts.reduce(
      (n, a) => n + a.flaggedClaims.length,
      0,
    );
    expect(expectedTotal).toBeGreaterThan(0);
    expect(checklist.totalClaims).toBe(expectedTotal);
    expect(checklist.claims).toHaveLength(expectedTotal);

    const byTypeTotal = Object.values(checklist.byType).reduce(
      (n, count) => n + (count ?? 0),
      0,
    );
    expect(byTypeTotal).toBe(expectedTotal);

    // A lesson-level checklist (just one lesson's artefacts, read back from the persisted
    // course) must be a strict subset of the course-level one — proves the helper genuinely
    // aggregates rather than always returning some fixed/global total.
    const persisted = getCourse(approved.id)!;
    const oneLessonArtefacts = persisted.modules[0]!.lessons[0]!.artefacts;
    const lessonChecklist = buildVerificationChecklist(oneLessonArtefacts);
    expect(lessonChecklist.totalClaims).toBeGreaterThan(0);
    expect(lessonChecklist.totalClaims).toBeLessThan(checklist.totalClaims);
  });

  it("mock artefact content never contains first-person markers (Decision 2 guard)", async () => {
    const { engine, approved } = await approvedCourse(
      "artefacts-impersonal-mock",
    );
    const artefacts = await engine.generateArtefacts(
      approved.id,
      ["textual"],
      style,
    );
    for (const artefact of artefacts) {
      const content = getArtefactContent(artefact.contentRef) ?? "";
      expect(content).not.toMatch(
        /\bI\b|\bI've\b|\bI'm\b|\bmy\b|in my experience/i,
      );
    }
  });
});
