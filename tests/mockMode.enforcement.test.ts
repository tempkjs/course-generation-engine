// Proves the guard in tests/support/forceMockMode.ts actually holds: even if AI_MODE=live is
// present in the environment (.env.local sets it for `pnpm test:live`'s convenience; a
// fumbled `npx vitest run` inherits it too), the mock suite must resolve to AI_MODE=mock
// regardless. See ADR 0017 addendum — the safety must not depend on running the right command.
import "./support/forceMockMode";
import { describe, it, expect } from "vitest";
import { getConfig } from "@/shared/config";

describe("mock-mode enforcement (ADR 0017 addendum)", () => {
  it("resolves to mock even when process.env.AI_MODE is 'live'", () => {
    // Simulates the exact failure this guards against: AI_MODE=live leaking in from
    // .env.local (or a stray shell export) after the file's own import chain has run.
    process.env.AI_MODE = "live";
    expect(getConfig().aiMode).toBe("mock");
  });
});
