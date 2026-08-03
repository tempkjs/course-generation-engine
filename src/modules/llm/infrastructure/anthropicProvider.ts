import type { LlmProvider, GenOpts } from '@/contracts';
import { getConfig, assertServerOnly } from '@/shared/config';
// Live provider. Copy the honed CareerAsana client wrapper here (below the scoping line) and rename.
export class AnthropicLlmProvider implements LlmProvider {
  async generate(_prompt: string, _opts?: GenOpts): Promise<string> {
    assertServerOnly('AnthropicLlmProvider');
    const { anthropicApiKey } = getConfig();
    if (!anthropicApiKey) throw new Error('ANTHROPIC_API_KEY missing in live mode');
    // TODO(seam-2, live): real Anthropic Messages call.
    throw new Error('AnthropicLlmProvider not yet implemented (live mode).');
  }
}
