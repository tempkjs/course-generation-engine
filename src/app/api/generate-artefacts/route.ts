// Server-only route — see src/app/api/generate-curriculum/route.ts for why this exists.
import { NextResponse } from "next/server";
import { getCourseEngine } from "@/modules/engine/server";
import type { ArtefactType, StyleProfile } from "@/contracts";

export async function POST(request: Request): Promise<Response> {
  const { courseId, prefs, style } = (await request.json()) as {
    courseId: string;
    prefs: ArtefactType[];
    style: StyleProfile;
  };
  const engine = getCourseEngine();
  const artefacts = await engine.generateArtefacts(courseId, prefs, style);
  return NextResponse.json(artefacts);
}
