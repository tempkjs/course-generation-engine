// Central AI_MODE + env resolution. Modules ask this, never read process.env directly.
import type { AiMode, EngineConfig } from "@/contracts";

let cached: EngineConfig | null = null;

export function getConfig(): EngineConfig {
  if (cached) return cached;
  const aiMode = (process.env.AI_MODE === "live" ? "live" : "mock") as AiMode;
  cached = {
    aiMode,
    anthropicApiKey: process.env.ANTHROPIC_API_KEY,
    anthropicModel: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5",
    supabaseUrl: process.env.SUPABASE_URL,
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
  };
  return cached;
}

export function isLive(): boolean {
  return getConfig().aiMode === "live";
}

/** Guard for server-only modules (engine, keys, cache). Throws if reached from the browser. */
export function assertServerOnly(where: string): void {
  if (typeof window !== "undefined") {
    throw new Error(
      `[boundary] ${where} is server-only and must not run in the browser.`,
    );
  }
}
