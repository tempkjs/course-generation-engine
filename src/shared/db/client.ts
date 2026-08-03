// Supabase client factory. Server-side usage for engine/cache; browser gets anon-only.
// NOTE: real @supabase/supabase-js wiring lands in live mode. Mock mode needs no client.
import { getConfig } from '@/shared/config';

export function hasDbConfigured(): boolean {
  const c = getConfig();
  return Boolean(c.supabaseUrl && c.supabaseAnonKey);
}
// TODO(seam-4, live): return a real SupabaseClient here; keep SOURCE and BUILD tables separate.
