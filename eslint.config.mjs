// Flat ESLint config (v9). Two jobs: (1) baseline TS correctness, (2) the CI-enforced
// public-import-only boundary — "modules import each other only through their index.ts"
// (CLAUDE.md, ENGINEERING_HANDBOOK.md §1). The boundary rule is derived from the actual
// src/modules/<name>/<layer> directory tree, not hard-coded per module, so a new module
// or layer is covered automatically without touching this file.
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import js from '@eslint/js';
import tseslint from 'typescript-eslint';

const modulesRoot = path.resolve(import.meta.dirname, 'src/modules');

function subdirs(dir) {
  return readdirSync(dir).filter((name) => statSync(path.join(dir, name)).isDirectory());
}

// Forbid importing any path under a module's internal layer directories
// (domain/application/infrastructure/ui/prompts/...) — a module's own public entry points
// (e.g. '@/modules/engine', '@/modules/engine/server') are plain files at the module root,
// not subdirectories, so they're never matched here. All modules' restrictions must live in
// ONE 'no-restricted-imports' rule entry: flat config doesn't merge separate config objects'
// `patterns` arrays for the same rule on the same file — a later block's rule value replaces
// an earlier one's outright, so splitting this per module (each with its own `ignores`) would
// silently leave only the last module's restriction active.
const boundaryPatterns = subdirs(modulesRoot).flatMap((moduleName) =>
  subdirs(path.join(modulesRoot, moduleName)).map((layer) => ({
    group: [`@/modules/${moduleName}/${layer}`, `@/modules/${moduleName}/${layer}/**`],
    message: `Deep import into modules/${moduleName}/${layer} is forbidden — import only via '@/modules/${moduleName}' (or '@/modules/${moduleName}/server' where that exists).`,
  })),
);

export default tseslint.config(
  { ignores: ['.next/**', 'node_modules/**', '*.tsbuildinfo', 'next-env.d.ts'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      // Seam 6 (BI) is the sanctioned event channel — ad-hoc logging elsewhere is a smell.
      // ConsoleEventSink is the one intentional exception (it IS the mock sink).
      'no-console': 'warn',
      'no-restricted-imports': ['error', { patterns: boundaryPatterns }],
    },
  },
);
