import type { KnowledgeRetriever, KnowledgeWriter } from "@/contracts";
import { MockKnowledgeCache } from "./infrastructure/mockCache";
export type { KnowledgeRetriever, KnowledgeWriter };
// TODO(seam-3, live): return a pgvector-backed cache; keep it DOMAIN-scoped.
const singleton = new MockKnowledgeCache();
export function getKnowledgeRetriever(): KnowledgeRetriever {
  return singleton;
}
export function getKnowledgeWriter(): KnowledgeWriter {
  return singleton;
}
