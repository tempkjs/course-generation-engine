import type {
  KnowledgeRetriever,
  KnowledgeWriter,
  RetrieveQuery,
  KnowledgeUnit,
} from "@/contracts";
import { assertServerOnly } from "@/shared/config";
// In-memory, deterministic. Real pgvector/Orq.ai adapter is a swap behind this interface.
const store = new Map<string, KnowledgeUnit>();
export class MockKnowledgeCache implements KnowledgeRetriever, KnowledgeWriter {
  async retrieve(query: RetrieveQuery): Promise<KnowledgeUnit[]> {
    assertServerOnly("KnowledgeCache.retrieve");
    return [...store.values()]
      .filter(
        (u) =>
          u.field === query.field && (!query.level || u.level === query.level),
      )
      .slice(0, query.topK);
  }
  async upsert(unit: KnowledgeUnit): Promise<void> {
    assertServerOnly("KnowledgeCache.upsert");
    store.set(unit.id, {
      ...unit,
      reuseCount: store.get(unit.id)?.reuseCount ?? 0,
    }); // flywheel signal
  }
}
