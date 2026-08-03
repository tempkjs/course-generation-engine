// Server-only route: the harness's CourseEngineClient calls this over HTTP so the engine,
// LLM keys, and SDK never enter the browser bundle (Rule B — see STANDING_GOTCHAS.md).
import { NextResponse } from 'next/server';
import { getCourseEngine } from '@/modules/engine/server';
import type { GenerateRequest } from '@/contracts';

export async function POST(request: Request): Promise<Response> {
  const req = (await request.json()) as GenerateRequest;
  const engine = getCourseEngine();
  const course = await engine.generateCurriculum(req);
  return NextResponse.json(course);
}
