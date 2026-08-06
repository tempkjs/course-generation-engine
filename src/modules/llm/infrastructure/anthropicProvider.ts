import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { LlmProvider, GenOpts } from "@/contracts";
import { getConfig, assertServerOnly } from "@/shared/config";
import { recordUsage } from "./usageTracker";

// Bumped from 8000: the Employee Relations jurisdiction=IN live run (ADR 0018) truncated
// BOTH artefact responses mid-JSON at the 8000 cap — India-grounded content cites more
// statutes/sections than the prior US-law baseline, so the { content, flaggedClaims }
// envelope needs more headroom to close before hitting the limit. A truncated envelope fails
// to parse and silently falls back to one defensive flag instead of the real claim list
// (domain/artefacts.ts's parseArtefactResponse) — this is the fix, not a workaround.
const DEFAULT_MAX_TOKENS = 16000;

// Bounded retry for transient errors (429 rate-limit, 5xx incl. Anthropic's 529
// "overloaded_error") — see ADR 0012. The Anthropic SDK's built-in retry already does
// exactly what we need (exponential backoff + jitter, never retries other 4xx); we only
// need to opt into a deliberate attempt count instead of its implicit default of 2 retries
// (3 total attempts), which one live run showed to be too little headroom for a sustained
// overload window. 3 retries => 4 total attempts.
const MAX_RETRIES = 3;

// Live provider — single Anthropic Messages API call, server-side only (Seam 2).
export class AnthropicLlmProvider implements LlmProvider {
  async generate(prompt: string, opts?: GenOpts): Promise<string> {
    assertServerOnly("AnthropicLlmProvider");
    const { anthropicApiKey, anthropicModel } = getConfig();
    if (!anthropicApiKey)
      throw new Error("ANTHROPIC_API_KEY missing in live mode");

    const client = new Anthropic({
      apiKey: anthropicApiKey,
      maxRetries: MAX_RETRIES,
    });
    const response = await client.messages.create({
      model: anthropicModel,
      max_tokens: opts?.maxTokens ?? DEFAULT_MAX_TOKENS,
      ...(opts?.temperature !== undefined
        ? { temperature: opts.temperature }
        : {}),
      messages: [{ role: "user", content: prompt }],
    });

    // Recorded regardless of stop_reason — even a refused/empty response consumed real
    // input tokens, and the whole point of ADR 0015 is an honest running total.
    recordUsage(response.usage.input_tokens, response.usage.output_tokens);

    if (response.stop_reason === "refusal") {
      throw new Error(
        "AnthropicLlmProvider: request declined by safety classifiers",
      );
    }

    let text = "";
    for (const block of response.content) {
      if (block.type === "text") text += block.text;
    }
    if (!text)
      throw new Error("AnthropicLlmProvider: empty response from model");
    return text;
  }
}
