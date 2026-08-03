// Seam 6 — Everything -> BI. Fire-and-forget; never on the critical path.
import type { Field } from './data';
export type DomainEvent =
  | { kind: 'curriculum_generated'; courseId: string }
  | { kind: 'artefact_approved'; artefactId: string }
  | { kind: 'artefact_rejected'; artefactId: string }
  | { kind: 'artefact_regenerated'; artefactId: string }
  | { kind: 'course_published'; courseId: string; lmsCourseId: string }
  | { kind: 'demand_registered'; courseId: string; field: Field }
  | { kind: 'batch_filled'; courseId: string; batchId: string };

export interface EventSink { emit(event: DomainEvent): void; }
