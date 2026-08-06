// Server-only route — see src/app/api/generate-curriculum/route.ts for why this exists.
// getArtefactContent is a test/route-facing peek (not part of CourseEngine/Seam 1 — see
// modules/engine/server.ts) that resolves an Artefact.contentRef pointer to its stored
// text. A UI that renders generated content needs this even though Seam 1 itself only
// hands back contentRef pointers (invariant 3 — no raw content in a Course/Artefact row).
import { NextResponse } from "next/server";
import { getArtefactContent } from "@/modules/engine/server";

export async function POST(request: Request): Promise<Response> {
  const { contentRef } = (await request.json()) as { contentRef: string };
  const content = getArtefactContent(contentRef) ?? "";
  return NextResponse.json({ content });
}
