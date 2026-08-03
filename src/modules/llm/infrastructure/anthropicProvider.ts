import 'server-only';
import Anthropic from '@anthropic-ai/sdk';
import type { LlmProvider, GenOpts } from '@/contracts';
import { getConfig, assertServerOnly } from '@/shared/config';

const DEFAULT_MAX_TOKENS = 8000;

// Live provider — single Anthropic Messages API call, server-side only (Seam 2).
export class AnthropicLlmProvider implements LlmProvider {
  async generate(prompt: string, opts?: GenOpts): Promise<string> {
    assertServerOnly('AnthropicLlmProvider');
    const { anthropicApiKey, anthropicModel } = getConfig();
    if (!anthropicApiKey) throw new Error('ANTHROPIC_API_KEY missing in live mode');

    const client = new Anthropic({ apiKey: anthropicApiKey });
    const response = await client.messages.create({
      model: anthropicModel,
      max_tokens: opts?.maxTokens ?? DEFAULT_MAX_TOKENS,
      ...(opts?.temperature !== undefined ? { temperature: opts.temperature } : {}),
      messages: [{ role: 'user', content: prompt }],
    });

    if (response.stop_reason === 'refusal') {
      throw new Error('AnthropicLlmProvider: request declined by safety classifiers');
    }

    let text = '';
    for (const block of response.content) {
      if (block.type === 'text') text += block.text;
    }
    if (!text) throw new Error('AnthropicLlmProvider: empty response from model');
    return text;
  }
}
