// Seam 1 CLIENT — the ONLY thing a UI imports. The disposable harness AND the real
// Swakojo Academy website both import this. Plug-and-play: same client, different host.
//
// Pure HTTP client — never imports the orchestrator/engine internals. That matters beyond
// style: engine internals (LiveCourseEngine -> AnthropicLlmProvider -> the Anthropic SDK)
// pull in node:fs/node:path, which breaks the browser build the moment anything upstream of
// this file imports them statically (see STANDING_GOTCHAS.md). Each method below is a thin
// wrapper over a server-only /api route.
import type { CourseEngine, GenerateRequest, Edit, ArtefactType, StyleProfile, Course, Artefact } from '@/contracts';

async function postJson<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} failed: ${res.status} ${await res.text()}`);
  return (await res.json()) as T;
}

export class CourseEngineClient implements CourseEngine {
  generateCurriculum(req: GenerateRequest): Promise<Course> {
    return postJson<Course>('/api/generate-curriculum', req);
  }
  refineCurriculum(courseId: string, edits: Edit[]): Promise<Course> {
    return postJson<Course>('/api/refine-curriculum', { courseId, edits });
  }
  generateArtefacts(courseId: string, prefs: ArtefactType[], style: StyleProfile): Promise<Artefact[]> {
    return postJson<Artefact[]>('/api/generate-artefacts', { courseId, prefs, style });
  }
  commitToCache(courseId: string): Promise<void> {
    return postJson<void>('/api/commit-to-cache', { courseId });
  }
}
