// Seam 1 — UI <-> Engine. The website imports this. The only way in.
import type {
  Course,
  StyleProfile,
  ArtefactType,
  Artefact,
  Field,
  Level,
  CadenceTemplate,
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
