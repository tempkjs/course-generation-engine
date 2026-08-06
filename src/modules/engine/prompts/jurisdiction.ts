// Shared jurisdiction-grounding instruction block, consumed by both prompts/curriculum.v2.ts
// and prompts/artefacts.v3.ts (ADR 0018). Not itself a versioned prompt asset in the
// governance sense — but its text shapes what both of those prompts produce, so treat an
// edit here as a behaviour change to BOTH consumers and bump their versions accordingly
// (e.g. curriculum.v2 -> v3, artefacts.v3 -> v4) rather than changing it silently in place.
import type { Jurisdiction } from "@/contracts";

// Concrete statutory anchors for jurisdictions where "which law" is the known failure mode
// (ADR 0018's motivating case was India). Extend additively as real demand names a new
// jurisdiction — never pre-build the full grid speculatively (same discipline as Appendix
// B.3's substrate pre-loading).
const JURISDICTION_ANCHORS: Record<string, string> = {
  IN: `India's own statutory framework is the PRIMARY frame for HR/employment and legal
content here — not a translation of another country's law. Depending on the topic, ground
content in: the POSH Act, 2013 (workplace sexual harassment); the Industrial Disputes Act,
1947; Standing Orders under the Industrial Employment (Standing Orders) Act, 1946; state
Shops & Establishments Acts; and the four Labour Codes (Wages; Industrial Relations; Social
Security; Occupational Safety, Health & Working Conditions). Name and use the actual Indian
statute, authority, or procedure directly — never frame it as "India's equivalent of Title
VII" or of any other foreign statute.`,
};

/**
 * Jurisdiction instruction block for a generation prompt (ADR 0018). Omitted jurisdiction
 * must produce NEUTRAL content, never a silent default to any particular country's law —
 * that silent default (to US law) is the exact bug this ADR fixes.
 */
export function jurisdictionInstruction(jurisdiction?: Jurisdiction): string {
  if (!jurisdiction) {
    return `JURISDICTION: none specified. Do NOT assume US law, or any other specific
country's law, as a default. Keep all legal/regulatory/statutory content jurisdiction-neutral
— state general principles and note explicitly where a jurisdiction-specific answer would be
needed, rather than defaulting to a particular country's framework.`;
  }
  const anchor = JURISDICTION_ANCHORS[jurisdiction.toUpperCase()];
  return `JURISDICTION: ${jurisdiction}. Ground ALL legal/regulatory/statutory content
NATIVELY in this jurisdiction's own law — its actual statutes, institutions, and procedure —
as the PRIMARY frame. Do NOT take another country's law (e.g. US law) as a baseline and
translate or map it onto this jurisdiction (never "this jurisdiction's equivalent of X").${
    anchor ? `\n\n${anchor}` : ""
  }`;
}
