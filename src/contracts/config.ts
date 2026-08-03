// Shared runtime config contract.
export type AiMode = 'mock' | 'live';
export interface EngineConfig {
  aiMode: AiMode;
  anthropicApiKey?: string; // only read server-side, only in live mode
  anthropicModel: string; // single standard Sonnet-class model (ADR 0007); resolved here, never hard-coded
  supabaseUrl?: string;
  supabaseAnonKey?: string;
}
