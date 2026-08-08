// Curated demo course catalog — replaces free-text Topic entry on /studio. Practitioners can
// only generate courses from this list (the demo/early-release control); each entry is meant
// to later map to one pre-built substrate (Appendix B.3, integration-contract.md). Deliberately
// small (~5-6 per field) — this is DATA the studio page reads, never hardcoded in the component.
//
// DATA ONLY — no contract change. Field/Level/Jurisdiction types come from @/contracts (open
// enums); this file just picks a small, fixed set of values for the demo.
import type { Field, Jurisdiction, Level } from "@/contracts";

export interface CatalogCourse {
  title: string;
  level: Level;
  jurisdiction?: Jurisdiction;
  durationWeeks: number;
}

// Field -> curated course list. Keep each list small; expanding it later is just adding rows.
export const DEMO_CATALOG: Record<Field, CatalogCourse[]> = {
  // Practitioner's shortlist for the Indian HR audience (ADR 0018 jurisdiction grounding).
  hr: [
    {
      title: "Employee Relations",
      level: "medium",
      jurisdiction: "IN",
      durationWeeks: 5,
    },
    {
      title: "Performance Management & Feedback",
      level: "medium",
      jurisdiction: "IN",
      durationWeeks: 4,
    },
    {
      title: "Interviewing & Hiring Skills",
      level: "basic",
      jurisdiction: "IN",
      durationWeeks: 3,
    },
    {
      title: "HR Business Partnering",
      level: "advanced",
      jurisdiction: "IN",
      durationWeeks: 6,
    },
    {
      title: "Employee Onboarding & Induction",
      level: "basic",
      jurisdiction: "IN",
      durationWeeks: 3,
    },
    {
      title: "Compensation & Benefits Design",
      level: "medium",
      jurisdiction: "IN",
      durationWeeks: 5,
    },
  ],
  // GST entry kept exactly as tests/live.ca-gst.test.ts's topic/field/level/durationWeeks
  // (jurisdiction-neutral there — GST is India-specific by domain vocabulary, not by an
  // explicit jurisdiction anchor) so that live-validated combination doesn't regress.
  ca: [
    {
      title: "GST Practical Implementation for Chartered Accountants",
      level: "medium",
      durationWeeks: 6,
    },
    {
      title: "Income Tax Return Filing for Individuals & Firms",
      level: "medium",
      jurisdiction: "IN",
      durationWeeks: 5,
    },
    {
      title: "Statutory Audit Fundamentals",
      level: "basic",
      jurisdiction: "IN",
      durationWeeks: 4,
    },
    {
      title: "Company Law & ROC Compliance",
      level: "advanced",
      jurisdiction: "IN",
      durationWeeks: 6,
    },
    {
      title: "Ind AS Practical Application",
      level: "advanced",
      jurisdiction: "IN",
      durationWeeks: 6,
    },
  ],
};

export const DEFAULT_CATALOG_FIELD: Field = "hr";
export const DEFAULT_CATALOG_COURSE_TITLE = "Employee Relations";

export function getCatalogFields(): Field[] {
  return Object.keys(DEMO_CATALOG);
}

export function getCatalogCourses(field: string): CatalogCourse[] {
  return DEMO_CATALOG[field] ?? [];
}

export function findCatalogCourse(
  field: string,
  title: string,
): CatalogCourse | undefined {
  return getCatalogCourses(field).find((c) => c.title === title);
}

// The fields a catalog selection drives together on the generate-curriculum request — pulled
// out as a pure mapping so the "selecting a course sets topic/level/jurisdiction/duration
// together" behaviour is unit-testable without rendering the studio page.
export function catalogEntryToRequestFields(entry: CatalogCourse): {
  topic: string;
  level: Level;
  jurisdiction: Jurisdiction | undefined;
  durationWeeks: number;
} {
  return {
    topic: entry.title,
    level: entry.level,
    jurisdiction: entry.jurisdiction,
    durationWeeks: entry.durationWeeks,
  };
}
