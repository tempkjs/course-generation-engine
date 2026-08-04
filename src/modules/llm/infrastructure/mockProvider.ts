import type { LlmProvider, GenOpts } from "@/contracts";
// Deterministic, no network. Used in AI_MODE=mock and in all tests.
export class MockLlmProvider implements LlmProvider {
  async generate(prompt: string, _opts?: GenOpts): Promise<string> {
    return `MOCK_LLM_RESPONSE::${prompt.slice(0, 48)}`;
  }
}
