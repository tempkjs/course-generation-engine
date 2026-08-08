// Guardrail (cheap cost control): the studio UI must NEVER trigger a whole-course artefact
// fan-out — the CA 48-call incident (see tests/live.ca-gst.test.ts's "LESSON SCOPING" note,
// and ADR 0014). Every generateArtefacts call from /studio is scoped to exactly the one
// lesson the practitioner selected; opts.lessonIds is never omitted from this call site.
import type { GenerateArtefactsOpts } from "@/contracts";

export function buildArtefactScope(lessonId: string): GenerateArtefactsOpts {
  if (!lessonId) {
    throw new Error(
      "buildArtefactScope: a lessonId is required — the studio UI must never generate " +
        "artefacts for a whole course (omitting opts.lessonIds means 'every lesson').",
    );
  }
  return { lessonIds: [lessonId] };
}
