import type { LlmProvider } from "@/contracts";
import { isLive } from "@/shared/config";
import { MockLlmProvider } from "./infrastructure/mockProvider";
import { AnthropicLlmProvider } from "./infrastructure/anthropicProvider";
export type { LlmProvider };
// Exported (not just used internally by getLlmProvider) so tests/llm.retry.test.ts can
// construct it directly and stub its transport — ADR 0012. A module-surface addition, same
// precedent as ADR 0010/0011's engine-module barrel growth; getLlmProvider's AI_MODE
// dispatch is unaffected.
export { AnthropicLlmProvider };
// Live-run token accounting (ADR 0015) — real Anthropic calls only; MockLlmProvider makes
// no request and has nothing real to total. Exported for live tests to report per-run cost.
export {
  getUsageTotals,
  resetUsageTotals,
  type UsageTotals,
} from "./infrastructure/usageTracker";
export function getLlmProvider(): LlmProvider {
  return isLive() ? new AnthropicLlmProvider() : new MockLlmProvider();
}
