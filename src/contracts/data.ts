// Canonical data contracts. Single source of truth. Do not redefine per module.
// SOURCE layer = the accreting cache (owned moat). BUILD layer = the disposable course.

export type Field = string; // open, broad — multi-disciplinary by design
export type Level = "basic" | "medium" | "advanced";
// Open enum, e.g. "IN", "US" — deliberately not a fixed union (ADR 0018): a jurisdiction
// anchor is data the prompt layer looks up, not a set this contract has to enumerate.
// Optional everywhere it appears; omitted means jurisdiction-NEUTRAL generation is required,
// never a silent default to any particular country's law.
export type Jurisdiction = string;
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

// ADR 0013 (v0.6): a claim the generator itself flagged as non-static — case/authority
// citations, dates, unsettled points, rates/thresholds/figures, named products/vendors, or
// anything else asserting current status. Flagged by NATURE regardless of the model's
// confidence; this is an in-generation checklist for the practitioner, not a correctness
// judgment. See ADR 0013 for the known false-negative tradeoff.
export interface FlaggedClaim {
  type:
    | "citation"
    | "date"
    | "unsettled"
    | "figure"
    | "product"
    | "other-nonstatic";
  text: string;
  note?: string;
}
export interface Artefact {
  id: string;
  type: ArtefactType;
  contentRef: string; // socket: pointer to stored content (never a raw blob in a row)
  generatedBy: "engine" | "practitioner";
  styleProfileRef?: string;
  approved: boolean; // false until the practitioner validates
  flaggedClaims: FlaggedClaim[]; // [] when nothing flagged (ADR 0013, added v0.6)
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
  jurisdiction?: Jurisdiction; // added v0.7, ADR 0018 — carried from GenerateRequest so
  // Phase 2 (generateArtefacts) can ground artefact content without re-asking
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
