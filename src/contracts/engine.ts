// Seam 1 — UI <-> Engine. The website imports this. The only way in.
import type {
  Course,
  StyleProfile,
  ArtefactType,
  Artefact,
  Field,
  Level,
  CadenceTemplate,
  Jurisdiction,
  SpineNode,
} from "./data";

export interface GenerateRequest {
  topic: string;
  field: Field;
  level: Level;
  audienceExperience: string;
  durationWeeks: number;
  cadence: CadenceTemplate;
  practitionerId: string;
  style: StyleProfile;
  // Added v0.7, ADR 0018. Omitted => generation must stay jurisdiction-NEUTRAL, never
  // default to any particular country's law (e.g. US). Provided => ground legal/regulatory
  // content NATIVELY in that jurisdiction's own statutory framework, not as a translation
  // of a US baseline.
  jurisdiction?: Jurisdiction;
}

export type Edit =
  | { op: "add"; parentId: string; node: Partial<SpineNode> }
  | { op: "remove"; nodeId: string }
  | { op: "update"; nodeId: string; patch: Partial<SpineNode> }
  | { op: "regenerate"; nodeId: string; instruction?: string };

// ADR 0014 (v0.5): omitted => every lesson in the course; lessonIds === [] is an error
// (ambiguous — "regenerate nothing" is never what a caller means).
export interface GenerateArtefactsOpts {
  lessonIds?: string[];
}

export interface CourseEngine {
  generateCurriculum(req: GenerateRequest): Promise<Course>; // generating -> draft
  refineCurriculum(courseId: string, edits: Edit[]): Promise<Course>; // add/remove/update/regenerate loop
  approveCurriculum(courseId: string): Promise<Course>; // draft -> validated (ADR 0009)
  generateArtefacts(
    courseId: string,
    prefs: ArtefactType[],
    style: StyleProfile,
    opts?: GenerateArtefactsOpts, // ADR 0014 (v0.5): optional lesson scoping
  ): Promise<Artefact[]>;
  commitToCache(courseId: string): Promise<void>; // flywheel — SERVER-SIDE ONLY
}
