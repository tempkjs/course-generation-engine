// Durable, gitignored local logs for the studio demo's regenerate/feedback loop — a stopgap
// until Supabase (App DB, Seam 4). Same append-to-a-gitignored-file shape as ADR 0015's
// tests/support/validationLog.ts, but for the running app rather than a single test run: one
// NDJSON file per log, appended forever, so patterns (e.g. which nodes get regenerated
// repeatedly) are greppable across sessions. Server-only — callers are API routes.
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export function appendDurableLog(
  dir: string,
  filename: string,
  entry: Record<string, unknown>,
): void {
  const fullDir = join(process.cwd(), dir);
  mkdirSync(fullDir, { recursive: true });
  const line = JSON.stringify({ ...entry, loggedAt: new Date().toISOString() });
  appendFileSync(join(fullDir, filename), `${line}\n`);
}
