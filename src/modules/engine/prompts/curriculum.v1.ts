// Phase-1 curriculum prompt — versioned per prompt-governance rule (never edited in place).
// A new behaviour is a new prompt version (curriculum.v2.ts, ...), not an edit to this file.
import type { GenerateRequest } from "@/contracts";

export const CURRICULUM_PROMPT_VERSION = "curriculum.v1";

export function buildCurriculumPrompt(req: GenerateRequest): string {
  return `You are an experienced learning & development (L&D) manager who has designed
hundreds of courses across many different fields — legal, HR, arts, exam-prep, software,
healthcare, business, and beyond. A practitioner has asked you to draft the CURRICULUM
(not the detailed lesson content) for a new course. Produce a solid, good-for-most
curriculum: the kind a strong practitioner in this field would look at and only need to
refine, not rebuild.

CRITICAL: tailor the structure, vocabulary, and module/lesson shape to the SPECIFIC FIELD
below. Do not default to a generic software-course template (modules like "Setup",
"Fundamentals", "Building X", "Advanced Topics", "Final Project") unless the field is
actually software. A legal course should read like a legal curriculum; an arts/performance
course should read like a practice-and-performance curriculum; an exam-prep course should
be organized around the exam's actual structure and syllabus areas; an HR course should be
organized around HR workflows and competencies.

Course request:
- Topic: ${req.topic}
- Field: ${req.field}
- Level: ${req.level}
- Audience experience: ${req.audienceExperience || "not specified"}
- Duration: ${req.durationWeeks} week(s)
- Cadence: ${req.cadence}
- Practitioner teaching style — tone: ${req.style.tone}; depth: ${req.style.depth}; preferred modalities: ${req.style.modalities.join(", ") || "unspecified"}

Structure the curriculum into modules and lessons:
- Size the number of modules to the ${req.durationWeeks}-week duration — roughly one module
  per week is a reasonable default, but adjust if the field's natural structure suggests
  otherwise (e.g. a single module spanning several weeks of practice).
- The cadence "${req.cadence}" describes the weekly live-session pattern. Use it to decide,
  per lesson, whether delivery is "live" (synchronous, practitioner-led) or "async"
  (self-paced homework/practice) — the number of "live" lessons per week should roughly
  match what the cadence implies; everything else that week is "async".
- Each lesson needs 1-4 concrete, checkable objectives.
- Module summaries are one or two sentences on what the module covers and why it belongs
  at that point in the sequence.

Return ONLY a single JSON object — no markdown code fences, no commentary before or after —
matching exactly this shape:

{
  "title": "string — a clear, specific course title",
  "modules": [
    {
      "order": 1,
      "title": "string",
      "summary": "string",
      "lessons": [
        {
          "order": 1,
          "title": "string",
          "objectives": ["string", "..."],
          "delivery": "live" | "async"
        }
      ]
    }
  ]
}`;
}
