// Public API of the engine module — the CLIENT-SAFE surface. UIs import ONLY from here.
// getCourseEngine() lives in ./server (server-only — see STANDING_GOTCHAS.md): it composes
// LiveCourseEngine -> AnthropicLlmProvider -> the Anthropic SDK, which needs Node builtins
// and never belongs in a browser bundle. Keeping it out of this file is what makes that true
// even transitively — a barrel that re-exports it would drag the whole chain into any bundle
// that imports anything from here at all.
export { CourseEngineClient } from "./ui/client";
export type {
  CourseEngine,
  GenerateRequest,
  Edit,
  GenerateArtefactsOpts,
} from "@/contracts";
