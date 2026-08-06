// Forces AI_MODE=mock for the importing test file, regardless of what the environment says
// (.env.local sets AI_MODE=live for convenience running `pnpm test:live`; a fumbled
// `npx vitest run` — no AI_MODE prefix — inherits that and silently runs "mock" test files
// against the real Anthropic API). The safety must not depend on running the right command,
// so every `*.mock.test.ts` file imports this FIRST, before any other import.
//
// getConfig() memoizes its result in a module-level singleton (src/shared/config.ts) that
// resolves once per test file (vitest isolates the module registry per file). Calling it here
// — immediately, at import time — locks that singleton to "mock" before any test body runs,
// so a later `process.env.AI_MODE = "live"` (accidental, or a test proving the guard) cannot
// un-cache it. See ADR 0017 addendum.
import { getConfig } from "@/shared/config";

process.env.AI_MODE = "mock";
getConfig();
