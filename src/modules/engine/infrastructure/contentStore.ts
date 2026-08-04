// Seam-4 mock: a PROCESS-LEVEL in-memory store for generated artefact CONTENT, keyed by the
// contentRef pointer an Artefact carries — never the raw content inline in a Course row (see
// integration-contract.md invariant 3, and Artefact.contentRef's "socket" comment). Same
// process-level-singleton reasoning as courseStore.ts: getCourseEngine() returns a new engine
// instance per call, so this can't live on `this`. Real storage (Supabase Storage / an object
// store — integration-contract.md §8 Open Item 1, still unresolved) replaces this later
// behind the same put/get shape; nothing above it changes when that swap happens.
const content = new Map<string, string>();

export function putContent(contentRef: string, value: string): void {
  content.set(contentRef, value);
}

export function getContent(contentRef: string): string | undefined {
  return content.get(contentRef);
}
