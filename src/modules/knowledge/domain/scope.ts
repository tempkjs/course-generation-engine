// The scoping rule made executable-as-documentation. The cache is DOMAIN-scoped.
// If you ever find yourself adding a `personId`/`userId`/`twinId` key here, STOP —
// that is CareerAsana's Twin bleeding in (see integration-contract Appendix A).
import type { RetrieveQuery } from '@/contracts';
export function cacheKey(q: Pick<RetrieveQuery, 'field' | 'domain' | 'level'>): string {
  return [q.field, q.domain ?? '*', q.level ?? '*'].join('::'); // domain, never person
}
