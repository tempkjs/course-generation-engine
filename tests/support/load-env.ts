// Raw vitest doesn't load .env.local (unlike Next.js dev/build). This setup file does,
// so `pnpm test:live` can pick up ANTHROPIC_API_KEY without exporting it manually.
// Vars already present in process.env win — an inline `ANTHROPIC_API_KEY=... pnpm test:live`
// must not be overridden by the file.
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function loadEnvLocal(): void {
  const path = resolve(process.cwd(), '.env.local');
  if (!existsSync(path)) return;

  for (const line of readFileSync(path, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

loadEnvLocal();
