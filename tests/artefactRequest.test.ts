// Pure logic, no AI_MODE/engine involvement — no forceMockMode import needed.
// Guardrail: the studio UI must never trigger a whole-course artefact fan-out (the CA
// 48-call incident — see tests/live.ca-gst.test.ts's "LESSON SCOPING" note, ADR 0014).
// buildArtefactScope is the ONLY place /studio builds a GenerateArtefactsOpts, and it can
// only ever produce a single-lesson scope — there is no code path in it that omits
// lessonIds (which would mean "every lesson in the course").
import { describe, it, expect } from "vitest";
import { buildArtefactScope } from "@/app/studio/artefactRequest";

describe("buildArtefactScope (no whole-course artefact fan-out guardrail)", () => {
  it("scopes to exactly the one selected lesson", () => {
    expect(buildArtefactScope("lesson-42")).toEqual({
      lessonIds: ["lesson-42"],
    });
  });

  it("never returns an opts value that omits lessonIds", () => {
    const opts = buildArtefactScope("lesson-1");
    expect(opts.lessonIds).toBeDefined();
    expect(opts.lessonIds!.length).toBe(1);
  });

  it("throws rather than silently falling back to a whole-course generation when no lesson is selected", () => {
    expect(() => buildArtefactScope("")).toThrow(/lessonId is required/);
  });
});
