// Pure logic, no AI_MODE/engine involvement — no forceMockMode import needed (nothing here
// can reach an LLM). Covers the studio /studio per-node regenerate cap (session-scoped,
// in-memory UI state — no contract change).
import { describe, it, expect } from "vitest";
import {
  artefactRegenKey,
  canRegenerate,
  MAX_REGENERATIONS_PER_NODE,
  recordRegen,
  regenCountFor,
  type RegenCounts,
} from "@/app/studio/regenCap";

describe("regenCap (per-node regenerate cap)", () => {
  it("allows regeneration up to the cap and blocks the 3rd regenerate on a node", () => {
    let counts: RegenCounts = {};
    const nodeId = "lesson-1";

    expect(canRegenerate(counts, nodeId)).toBe(true); // 0 used
    counts = recordRegen(counts, nodeId);
    expect(canRegenerate(counts, nodeId)).toBe(true); // 1 used, cap is 2

    counts = recordRegen(counts, nodeId);
    expect(regenCountFor(counts, nodeId)).toBe(MAX_REGENERATIONS_PER_NODE);
    expect(canRegenerate(counts, nodeId)).toBe(false); // 2 used — the 3rd attempt is blocked
  });

  it("caps are independent per node id", () => {
    let counts: RegenCounts = {};
    counts = recordRegen(counts, "module-a");
    counts = recordRegen(counts, "module-a");

    expect(canRegenerate(counts, "module-a")).toBe(false);
    expect(canRegenerate(counts, "module-b")).toBe(true);
  });

  it("artefact (re)generation uses a namespaced key so it doesn't share budget with a curriculum node regenerate on the same lesson id", () => {
    let counts: RegenCounts = {};
    counts = recordRegen(counts, "lesson-9"); // curriculum node regenerate on lesson-9
    counts = recordRegen(counts, "lesson-9");

    // lesson-9's curriculum-regen cap is hit...
    expect(canRegenerate(counts, "lesson-9")).toBe(false);
    // ...but that lesson's artefact generation budget is untouched.
    expect(canRegenerate(counts, artefactRegenKey("lesson-9"))).toBe(true);
  });
});
