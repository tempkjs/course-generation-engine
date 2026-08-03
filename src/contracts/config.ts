// Shared runtime config contract.
export type AiMode = 'mock' | 'live';
export interface EngineConfig {
  aiMode: AiMode;
  anthropicApiKey?: string; // only read server-side, only in live mode
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}
