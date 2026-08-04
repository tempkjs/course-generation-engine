import { describe, it, expect } from "vitest";
import { getCourseEngine } from "@/modules/engine/server";
import type { GenerateRequest, StyleProfile } from "@/contracts";

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

describe("refineCurriculum + approveCurriculum (AI_MODE=mock)", () => {
  it("add inserts a lesson under an existing module, and a module under the course", async () => {
    const engine = getCourseEngine();
    const c = await engine.generateCurriculum(req("add-ops"));
    const targetModule = c.modules[0]!;

    const withLesson = await engine.refineCurriculum(c.id, [
      {
        op: "add",
        parentId: targetModule.id,
        node: { title: "New lesson", objectives: ["Do the thing"] },
      },
    ]);
    const module = withLesson.modules.find((m) => m.id === targetModule.id)!;
    expect(module.lessons.some((l) => l.title === "New lesson")).toBe(true);

    const withModule = await engine.refineCurriculum(c.id, [
      { op: "add", parentId: c.id, node: { title: "New module" } },
    ]);
    expect(withModule.modules.some((m) => m.title === "New module")).toBe(true);
    expect(withModule.status).toBe("draft");
  });

  it("update patches a module title and a lesson title/objectives", async () => {
    const engine = getCourseEngine();
    const c = await engine.generateCurriculum(req("update-ops"));
    const module = c.modules[0]!;
    const lesson = module.lessons[0]!;

    const after = await engine.refineCurriculum(c.id, [
      { op: "update", nodeId: module.id, patch: { title: "Renamed module" } },
      {
        op: "update",
        nodeId: lesson.id,
        patch: { title: "Renamed lesson", objectives: ["New objective"] },
      },
    ]);
    const updatedModule = after.modules.find((m) => m.id === module.id)!;
    expect(updatedModule.title).toBe("Renamed module");
    const updatedLesson = updatedModule.lessons.find(
      (l) => l.id === lesson.id,
    )!;
    expect(updatedLesson.title).toBe("Renamed lesson");
    expect(updatedLesson.objectives).toEqual(["New objective"]);
  });

  it("regenerate produces a title different from the original, via the LLM seam", async () => {
    const engine = getCourseEngine();
    const c = await engine.generateCurriculum(req("regenerate-ops"));
    const module = c.modules[0]!;

    const after = await engine.refineCurriculum(c.id, [
      { op: "regenerate", nodeId: module.id, instruction: "make it punchier" },
    ]);
    const regenerated = after.modules.find((m) => m.id === module.id)!;
    expect(regenerated.title).not.toBe(module.title);
    expect(after.status).toBe("draft");
  });

  it("refineCurriculum is rejected once the course is no longer draft", async () => {
    const engine = getCourseEngine();
    const c = await engine.generateCurriculum(req("reject-refine"));
    await engine.approveCurriculum(c.id);

    await expect(
      engine.refineCurriculum(c.id, [
        { op: "update", nodeId: c.modules[0]!.id, patch: { title: "x" } },
      ]),
    ).rejects.toThrow(/draft/);
  });

  it("approveCurriculum transitions draft -> validated", async () => {
    const engine = getCourseEngine();
    const c = await engine.generateCurriculum(req("approve-ops"));
    expect(c.status).toBe("draft");

    const approved = await engine.approveCurriculum(c.id);
    expect(approved.status).toBe("validated");
  });

  it("approveCurriculum rejects a course that is not draft", async () => {
    const engine = getCourseEngine();
    const c = await engine.generateCurriculum(req("approve-twice"));
    await engine.approveCurriculum(c.id);

    await expect(engine.approveCurriculum(c.id)).rejects.toThrow(/draft/);
  });

  it("generateArtefacts throws before approval and succeeds after (ADR 0004 gate)", async () => {
    const engine = getCourseEngine();
    const c = await engine.generateCurriculum(req("gate-ops"));
    const style: StyleProfile = {
      practitionerId: "p",
      modalities: ["textual"],
      tone: "plain",
      depth: "working",
    };

    await expect(
      engine.generateArtefacts(c.id, ["textual"], style),
    ).rejects.toThrow(/validated/);

    await engine.approveCurriculum(c.id);
    const artefacts = await engine.generateArtefacts(c.id, ["textual"], style);
    expect(artefacts).toHaveLength(1);
    expect(artefacts[0]!.type).toBe("textual");
  });
});
