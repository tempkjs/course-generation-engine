// Canonical data contracts. Single source of truth. Do not redefine per module.
// SOURCE layer = the accreting cache (owned moat). BUILD layer = the disposable course.

export type Field = string; // open, broad — multi-disciplinary by design
export type Level = "basic" | "medium" | "advanced";
export type PriceBand = "short" | "standard" | "intensive"; // from the revenue model
export type CadenceTemplate = string; // one of the small fixed weekly-slot shapes
export type ArtefactType =
  "textual" | "visual" | "slide" | "quiz" | "code_challenge" | "presentation";
export type AssessmentType =
  "quiz" | "code_challenge" | "presentation" | "assignment";

// ---- SOURCE layer: the knowledge cache (server-side only; DOMAIN-scoped, never person-scoped) ----
export interface SpineNode {
  order: number;
  title: string;
  kind: "module" | "lesson";
  objectives?: string[];
  children?: SpineNode[];
}
export interface ArtefactSeed {
  type: ArtefactType;
  skeleton: string;
}
export interface Provenance {
  origin: "generated" | "practitioner" | "hybrid";
  contributorIds: string[];
}
export interface QualitySignal {
  kind: "approved" | "edited" | "rejected" | "regenerated";
  weight: number;
}

export interface KnowledgeUnit {
  id: string;
  field: Field;
  domain: string; // finer topic, e.g. "contract-drafting" — NOT a person
  level: Level;
  curriculumSpine: SpineNode[];
  starterArtefacts: ArtefactSeed[];
  provenance: Provenance;
  embeddingRef: string; // socket: vector id in RAG infra
  version: number;
  reuseCount: number; // flywheel signal
  qualitySignals: QualitySignal[];
}

// ---- BUILD layer: the course instance (disposable) ----
export type CourseStatus = "draft" | "generating" | "validated" | "published";

export interface Artefact {
  id: string;
  type: ArtefactType;
  contentRef: string; // socket: pointer to stored content (never a raw blob in a row)
  generatedBy: "engine" | "practitioner";
  styleProfileRef?: string;
  approved: boolean; // false until the practitioner validates
}
export interface Lesson {
  id: string;
  order: number;
  title: string;
  objectives: string[];
  delivery: "live" | "async";
  artefacts: Artefact[];
}
export interface Module {
  id: string;
  order: number;
  title: string;
  summary: string;
  lessons: Lesson[];
}
export interface Assessment {
  id: string;
  scope: "course" | "lesson";
  type: AssessmentType;
  spec: string;
  contentRef: string;
}
export interface Session {
  id: string;
  courseId: string;
  batchId: string;
  slot: string;
  meetingUrl?: string; // socket
}
export interface Course {
  id: string;
  status: CourseStatus; // never skip states
  title: string;
  field: Field;
  level: Level;
  practitionerId: string;
  priceBand: PriceBand;
  cadence: CadenceTemplate;
  isExamPrep?: boolean; // raises the validation gate
  sourceRefs: string[]; // KnowledgeUnit ids this course drew from (Source vs Build)
  modules: Module[];
  publishedLmsId?: string; // socket: set on publish
  createdAt: string;
}

// ---- teaching-style conditioning: what makes output "this practitioner", not generic ----
export interface StyleProfile {
  practitionerId: string;
  modalities: ArtefactType[];
  tone: string;
  depth: "overview" | "working" | "deep";
  voiceSamplesRef?: string; // socket
}
