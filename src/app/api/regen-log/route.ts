// Server-only route. Not part of CourseEngine/Seam 1 — a stopgap durable log (until Supabase)
// of EVERY regeneration the studio UI fires, curriculum node or per-lesson artefact, so which
// substrates get regenerated repeatedly is a visible, greppable signal (see regen-log/).
import { NextResponse } from "next/server";
import { appendDurableLog } from "@/shared/durableLog";

export async function POST(request: Request): Promise<Response> {
  const { courseId, nodeId, kind, instruction } = (await request.json()) as {
    courseId: string;
    nodeId: string;
    kind: "curriculum" | "artefact";
    instruction?: string;
  };
  appendDurableLog("regen-log", "regenerations.ndjson", {
    courseId,
    nodeId,
    kind,
    instruction: instruction ?? null,
  });
  return NextResponse.json({ ok: true });
}
