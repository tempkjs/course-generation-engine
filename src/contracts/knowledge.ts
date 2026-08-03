// Seam 3 — Engine <-> RAG/cache. Server-side only. DOMAIN-scoped (never person-scoped).
import type { KnowledgeUnit, Field, Level } from './data';

export interface RetrieveQuery {
  field: Field;
  domain?: string;
  level?: Level;
  text: string;
  topK: number;
}
export interface KnowledgeRetriever { retrieve(query: RetrieveQuery): Promise<KnowledgeUnit[]>; }
export interface KnowledgeWriter { upsert(unit: KnowledgeUnit): Promise<void>; }
