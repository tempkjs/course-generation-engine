// Seam 2 — Engine <-> LLM. Provider swappable. Keys server-side only.
export interface GenOpts {
  maxTokens?: number;
  temperature?: number;
}
export interface LlmProvider {
  generate(prompt: string, opts?: GenOpts): Promise<string>;
}
