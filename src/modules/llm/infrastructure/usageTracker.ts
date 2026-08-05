// Seam-2 observability (ADR 0015): process-level token-usage accounting for live Anthropic
// calls — the standing source for real Phase-2 (and Phase-1/refine) cost data. Same
// process-level-singleton shape as courseStore.ts/contentStore.ts (ADR 0009/0011). Mock
// calls make no real request and cost nothing, so MockLlmProvider never records here.
export interface UsageTotals {
  calls: number;
  inputTokens: number;
  outputTokens: number;
}

let totals: UsageTotals = { calls: 0, inputTokens: 0, outputTokens: 0 };

export function recordUsage(inputTokens: number, outputTokens: number): void {
  totals = {
    calls: totals.calls + 1,
    inputTokens: totals.inputTokens + inputTokens,
    outputTokens: totals.outputTokens + outputTokens,
  };
}

export function getUsageTotals(): UsageTotals {
  return totals;
}

export function resetUsageTotals(): void {
  totals = { calls: 0, inputTokens: 0, outputTokens: 0 };
}
