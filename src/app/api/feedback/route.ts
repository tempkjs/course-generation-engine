// Server-only route. Not part of CourseEngine/Seam 1 — a stopgap durable log (until Supabase)
// of the hand-off feedback a practitioner leaves once a node hits its regenerate cap
// (see src/app/studio/regenCap.ts). Captures the instructions already tried on that node so
// the feedback reads in context, not just as a bare complaint.
import { NextResponse } from "next/server";
import { appendDurableLog } from "@/shared/durableLog";

export async function POST(request: Request): Promise<Response> {
  const { courseId, nodeId, instructionsTried, feedback } =
    (await request.json()) as {
      courseId: string;
      nodeId: string;
      instructionsTried: string[];
      feedback: string;
    };
  appendDurableLog("feedback", "feedback.ndjson", {
    courseId,
    nodeId,
    instructionsTried,
    feedback,
  });
  return NextResponse.json({ ok: true });
}
