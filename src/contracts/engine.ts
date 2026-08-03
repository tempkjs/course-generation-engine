// Seam 1 — UI <-> Engine. The website imports this. The only way in.
import type { Course, StyleProfile, ArtefactType, Artefact, Field, Level, CadenceTemplate, SpineNode } from './data';

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
  | { op: 'add'; parentId: string; node: Partial<SpineNode> }
  | { op: 'remove'; nodeId: string }
  | { op: 'update'; nodeId: string; patch: Partial<SpineNode> }
  | { op: 'regenerate'; nodeId: string; instruction?: string };

export interface CourseEngine {
  generateCurriculum(req: GenerateRequest): Promise<Course>;               // generating -> draft
  refineCurriculum(courseId: string, edits: Edit[]): Promise<Course>;      // validate/regenerate loop
  generateArtefacts(courseId: string, prefs: ArtefactType[], style: StyleProfile): Promise<Artefact[]>;
  commitToCache(courseId: string): Promise<void>;                          // flywheel — SERVER-SIDE ONLY
}
