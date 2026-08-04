// Deterministic, no real network: stubs globalThis.fetch (which the Anthropic SDK resolves
// fresh on every `new Anthropic(...)` construction inside AnthropicLlmProvider.generate())
// to simulate transient and non-transient failures, proving the retry/backoff policy
// configured in ADR 0012 actually behaves as documented — not just "it compiles."
import { afterEach, describe, expect, it, vi } from "vitest";
import { AnthropicLlmProvider } from "@/modules/llm";

// Set before any getConfig() call so AnthropicLlmProvider always sees a non-empty key,
// regardless of whether .env.local happens to be present — this test never makes a real
// network call (fetch is always stubbed below), so the value itself is irrelevant.
process.env.ANTHROPIC_API_KEY = "test-key-for-retry-simulation";

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

const OVERLOADED_BODY = {
  type: "error",
  error: { type: "overloaded_error", message: "Overloaded" },
};

const BAD_REQUEST_BODY = {
  type: "error",
  error: { type: "invalid_request_error", message: "bad request" },
};

const SUCCESS_BODY = {
  id: "msg_test",
  type: "message",
  role: "assistant",
  model: "claude-sonnet-5",
  content: [{ type: "text", text: "recovered after retry" }],
  stop_reason: "end_turn",
  stop_sequence: null,
  usage: { input_tokens: 10, output_tokens: 5 },
};

describe("AnthropicLlmProvider retry/backoff (ADR 0012)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("retries a transient 529 (Overloaded) and succeeds, without surfacing the first failure", async () => {
    let callCount = 0;
    const fetchStub = vi.fn(async () => {
      callCount += 1;
      return callCount === 1
        ? jsonResponse(529, OVERLOADED_BODY)
        : jsonResponse(200, SUCCESS_BODY);
    });
    vi.stubGlobal("fetch", fetchStub);

    const provider = new AnthropicLlmProvider();
    const text = await provider.generate("prompt");

    expect(text).toBe("recovered after retry");
    expect(callCount).toBeGreaterThan(1); // proves a retry actually happened
  });

  it("does not retry a non-transient error (400 bad request) — fails on the first attempt", async () => {
    const fetchStub = vi.fn(async () => jsonResponse(400, BAD_REQUEST_BODY));
    vi.stubGlobal("fetch", fetchStub);

    const provider = new AnthropicLlmProvider();
    await expect(provider.generate("prompt")).rejects.toThrow();
    expect(fetchStub).toHaveBeenCalledTimes(1); // no retry for a non-transient 4xx
  });

  it("gives up after the retry cap and throws the original error", async () => {
    const fetchStub = vi.fn(async () => jsonResponse(529, OVERLOADED_BODY));
    vi.stubGlobal("fetch", fetchStub);

    const provider = new AnthropicLlmProvider();
    await expect(provider.generate("prompt")).rejects.toThrow(/overloaded/i);
    // ADR 0012: 3 retries => 4 total attempts.
    expect(fetchStub).toHaveBeenCalledTimes(4);
  }, 15_000); // real (short) backoff delays between attempts, not mocked — a few seconds
});
