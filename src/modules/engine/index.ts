// Public API of the engine module — the CLIENT-SAFE surface. UIs import ONLY from here.
// getCourseEngine() lives in ./server (server-only — see STANDING_GOTCHAS.md): it composes
// LiveCourseEngine -> AnthropicLlmProvider -> the Anthropic SDK, which needs Node builtins
// and never belongs in a browser bundle. Keeping it out of this file is what makes that true
// even transitively — a barrel that re-exports it would drag the whole chain into any bundle
// that imports anything from here at all.
export { CourseEngineClient, fetchArtefactContent } from "./ui/client";
// Pure derivation (ADR 0013) — no I/O, safe in the browser bundle. For a future
// practitioner-facing checklist UI: pass one lesson's artefacts for a lesson-level
// checklist, or a whole course's for a course-level one.
export { buildVerificationChecklist } from "./domain/artefacts";
export type {
  CourseEngine,
  GenerateRequest,
  Edit,
  GenerateArtefactsOpts,
} from "@/contracts";
export type { VerificationChecklist } from "./domain/artefacts";
