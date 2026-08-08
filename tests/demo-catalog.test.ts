// Pure data + pure mapping, no AI_MODE/engine involvement — no forceMockMode import needed.
// Covers the curated /studio catalog (src/config/demo-catalog.ts) that replaced the free-text
// Topic field: field -> curated course list, and "selecting a course sets topic + level +
// jurisdiction + durationWeeks together".
import { describe, it, expect } from "vitest";
import {
  DEFAULT_CATALOG_COURSE_TITLE,
  DEFAULT_CATALOG_FIELD,
  catalogEntryToRequestFields,
  findCatalogCourse,
  getCatalogCourses,
  getCatalogFields,
} from "@/config/demo-catalog";

describe("demo-catalog", () => {
  it("preselects the hr field with Employee Relations for the demo", () => {
    expect(DEFAULT_CATALOG_FIELD).toBe("hr");
    expect(DEFAULT_CATALOG_COURSE_TITLE).toBe("Employee Relations");
    expect(
      findCatalogCourse(DEFAULT_CATALOG_FIELD, DEFAULT_CATALOG_COURSE_TITLE),
    ).toBeDefined();
  });

  it("keeps every field's list small (~5-6 entries) so each can map to one substrate", () => {
    for (const field of getCatalogFields()) {
      const courses = getCatalogCourses(field);
      expect(courses.length).toBeGreaterThanOrEqual(4);
      expect(courses.length).toBeLessThanOrEqual(6);
    }
  });

  it("keeps the hr practitioner shortlist, all jurisdiction IN", () => {
    const hr = getCatalogCourses("hr");
    const titles = hr.map((c) => c.title);
    expect(titles).toEqual(
      expect.arrayContaining([
        "Employee Relations",
        "Performance Management & Feedback",
        "Interviewing & Hiring Skills",
        "HR Business Partnering",
      ]),
    );
    expect(hr.every((c) => c.jurisdiction === "IN")).toBe(true);
  });

  it("keeps a ca entry (GST) so nothing regresses", () => {
    const entry = findCatalogCourse(
      "ca",
      "GST Practical Implementation for Chartered Accountants",
    );
    expect(entry).toEqual({
      title: "GST Practical Implementation for Chartered Accountants",
      level: "medium",
      durationWeeks: 6,
    });
  });

  it("selecting a course populates topic + level + jurisdiction + durationWeeks together", () => {
    const entry = findCatalogCourse("hr", "HR Business Partnering")!;
    expect(catalogEntryToRequestFields(entry)).toEqual({
      topic: "HR Business Partnering",
      level: "advanced",
      jurisdiction: "IN",
      durationWeeks: 6,
    });
  });

  it("an unknown field or title yields no catalog entry (never a made-up default)", () => {
    expect(getCatalogCourses("not-a-real-field")).toEqual([]);
    expect(findCatalogCourse("hr", "Not A Real Course")).toBeUndefined();
  });
});
