import type { LlmProvider } from "@/contracts";
import { isLive } from "@/shared/config";
import { MockLlmProvider } from "./infrastructure/mockProvider";
import { AnthropicLlmProvider } from "./infrastructure/anthropicProvider";
export type { LlmProvider };
export function getLlmProvider(): LlmProvider {
  return isLive() ? new AnthropicLlmProvider() : new MockLlmProvider();
}
