// Durable validation output (ADR 0015). Live validation tests print a lot of generated
// content for a human to judge. A logfile only the agent running the test happened to see
// isn't good enough — the architect needs to read the PRIMARY text, not a paraphrase of it
// (a paraphrase is exactly what nearly misrepresented the CA/GST run's citations). This
// writes every logged line to both the console (as before) and a durable, gitignored file
// under validation-output/, so "read the output" means opening a file in the repo.
import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

export interface ValidationLog {
  log: (message: string) => void;
  path: string;
}

export function createValidationLog(testName: string): ValidationLog {
  const dir = join(process.cwd(), "validation-output");
  mkdirSync(dir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const path = join(dir, `${testName}-${timestamp}.log`);

  // The one sanctioned console.log for all live validation tests — ADR 0015. They call
  // log(), not console.log directly, so this is the single place that needs the exception.
  return {
    path,
    log(message: string): void {
      /* eslint-disable-next-line no-console */
      console.log(message);
      appendFileSync(path, `${message}\n`);
    },
  };
}
