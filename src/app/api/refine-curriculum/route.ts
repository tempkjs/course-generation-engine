// Server-only route — see src/app/api/generate-curriculum/route.ts for why this exists.
import { NextResponse } from 'next/server';
import { getCourseEngine } from '@/modules/engine/server';
import type { Edit } from '@/contracts';

export async function POST(request: Request): Promise<Response> {
  const { courseId, edits } = (await request.json()) as { courseId: string; edits: Edit[] };
  const engine = getCourseEngine();
  const course = await engine.refineCurriculum(courseId, edits);
  return NextResponse.json(course);
}
