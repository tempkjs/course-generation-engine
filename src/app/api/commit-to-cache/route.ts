// Server-only route — see src/app/api/generate-curriculum/route.ts for why this exists.
import { NextResponse } from 'next/server';
import { getCourseEngine } from '@/modules/engine/server';

export async function POST(request: Request): Promise<Response> {
  const { courseId } = (await request.json()) as { courseId: string };
  const engine = getCourseEngine();
  await engine.commitToCache(courseId);
  return NextResponse.json({ ok: true });
}
