// Pure domain: status transitions + applying edits to a curriculum tree. No I/O.
import type {
  Course,
  CourseStatus,
  Module,
  Lesson,
  GenerateRequest,
} from "@/contracts";
import type { Edit } from "@/contracts";

const ORDER: CourseStatus[] = ["generating", "draft", "validated", "published"];
export function canTransition(from: CourseStatus, to: CourseStatus): boolean {
  return ORDER.indexOf(to) === ORDER.indexOf(from) + 1; // never skip states
}

/** ADR 0004 / invariant 3: generateArtefacts (Phase 2) is forbidden pre-approval. */
export function assertValidatedForArtefacts(
  course: Course | undefined,
): asserts course is Course {
  if (!course || course.status !== "validated") {
    throw new Error(
      `generateArtefacts is forbidden unless course.status === 'validated' (ADR 0004) — got '${course?.status ?? "unknown course"}'`,
    );
  }
}

/** ADR 0009: refineCurriculum is permitted only while a course is 'draft'. */
export function assertDraftForRefine(course: Course): void {
  if (course.status !== "draft") {
    throw new Error(
      `refineCurriculum is only permitted on a 'draft' course — got '${course.status}'`,
    );
  }
}

/** ADR 0009: approveCurriculum requires the existing canTransition ladder guard (draft -> validated). */
export function assertApprovable(course: Course): void {
  if (!canTransition(course.status, "validated")) {
    throw new Error(
      `approveCurriculum requires a 'draft' course (ADR 0009) — got '${course.status}'`,
    );
  }
}

/** Parse + validate the Phase-1 LLM response into a Course, coercing status to 'draft'. */
export function parseCurriculumResponse(
  raw: string,
  req: GenerateRequest,
): Course {
  const parsed = extractJsonObject(raw);
  const record = parsed as Record<string, unknown>;

  const title =
    typeof record.title === "string" && record.title.trim()
      ? record.title
      : req.topic;
  const rawModules = record.modules;
  if (!Array.isArray(rawModules) || rawModules.length === 0) {
    throw new Error(
      'Curriculum LLM response is missing a non-empty "modules" array',
    );
  }

  const slug = req.topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-+|-+$)/g, "");
  const id = `course-${slug || "untitled"}-${Math.random().toString(36).slice(2, 8)}`;

  const modules: Module[] = rawModules.map((rawModule, moduleIndex) => {
    if (typeof rawModule !== "object" || rawModule === null) {
      throw new Error(
        `Curriculum module at index ${moduleIndex} is not an object`,
      );
    }
    const mod = rawModule as Record<string, unknown>;
    const moduleOrder =
      typeof mod.order === "number" ? mod.order : moduleIndex + 1;
    const moduleTitle =
      typeof mod.title === "string" && mod.title.trim()
        ? mod.title
        : `Module ${moduleOrder}`;
    const summary = typeof mod.summary === "string" ? mod.summary : "";
    const moduleId = `${id}-m${moduleOrder}`;

    const rawLessons = mod.lessons;
    if (!Array.isArray(rawLessons) || rawLessons.length === 0) {
      throw new Error(`Curriculum module "${moduleTitle}" has no lessons`);
    }
    const lessons: Lesson[] = rawLessons.map((rawLesson, lessonIndex) => {
      if (typeof rawLesson !== "object" || rawLesson === null) {
        throw new Error(
          `Lesson at index ${lessonIndex} in module "${moduleTitle}" is not an object`,
        );
      }
      const lesson = rawLesson as Record<string, unknown>;
      const lessonOrder =
        typeof lesson.order === "number" ? lesson.order : lessonIndex + 1;
      const lessonTitle =
        typeof lesson.title === "string" && lesson.title.trim()
          ? lesson.title
          : `Lesson ${moduleOrder}.${lessonOrder}`;
      const objectives = Array.isArray(lesson.objectives)
        ? lesson.objectives.filter((o): o is string => typeof o === "string")
        : [];
      const delivery: Lesson["delivery"] =
        lesson.delivery === "live" ? "live" : "async";
      return {
        id: `${moduleId}-l${lessonOrder}`,
        order: lessonOrder,
        title: lessonTitle,
        objectives,
        delivery,
        artefacts: [],
      };
    });

    return {
      id: moduleId,
      order: moduleOrder,
      title: moduleTitle,
      summary,
      lessons,
    };
  });

  return {
    id,
    status: "draft", // coerced regardless of what the model returned (ADR 0004 ladder starts here)
    title,
    field: req.field,
    level: req.level,
    practitionerId: req.practitionerId,
    priceBand: "standard",
    cadence: req.cadence,
    jurisdiction: req.jurisdiction, // ADR 0018 — carried forward for Phase 2
    sourceRefs: [],
    modules,
    createdAt: new Date().toISOString(),
  };
}

export function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end === -1 || end <= start) {
      throw new Error(
        "Curriculum LLM response did not contain a parseable JSON object",
      );
    }
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

/**
 * Apply structural practitioner edits (add/remove/update) to a course's module/lesson tree.
 * Pure and synchronous — no LLM involved. 'regenerate' needs the LLM seam and is handled by
 * the application layer (see application/refine.ts), which calls this for the other ops.
 */
export function applyEdits(course: Course, edits: Edit[]): Course {
  let modules = course.modules;
  for (const edit of edits) {
    switch (edit.op) {
      case "remove":
        modules = modules
          .filter((m) => m.id !== edit.nodeId)
          .map((m) => ({
            ...m,
            lessons: m.lessons.filter((l) => l.id !== edit.nodeId),
          }));
        break;
      case "update":
        modules = modules.map((m) => {
          if (m.id === edit.nodeId) {
            return edit.patch.title ? { ...m, title: edit.patch.title } : m;
          }
          return {
            ...m,
            lessons: m.lessons.map((l) => {
              if (l.id !== edit.nodeId) return l;
              return {
                ...l,
                ...(edit.patch.title ? { title: edit.patch.title } : {}),
                ...(edit.patch.objectives
                  ? { objectives: edit.patch.objectives }
                  : {}),
              };
            }),
          };
        });
        break;
      case "add":
        // parentId === course.id -> new top-level module; otherwise parentId is a moduleId
        // and the node is inserted as a lesson under it.
        if (edit.parentId === course.id) {
          const order = edit.node.order ?? modules.length + 1;
          modules = [
            ...modules,
            {
              id: `${course.id}-m${order}`,
              order,
              title: edit.node.title ?? `Module ${order}`,
              summary: "",
              lessons: [],
            },
          ];
        } else {
          modules = modules.map((m) => {
            if (m.id !== edit.parentId) return m;
            const order = edit.node.order ?? m.lessons.length + 1;
            const lesson: Lesson = {
              id: `${m.id}-l${order}`,
              order,
              title: edit.node.title ?? `Lesson ${m.order}.${order}`,
              objectives: edit.node.objectives ?? [],
              delivery: "async",
              artefacts: [],
            };
            return { ...m, lessons: [...m.lessons, lesson] };
          });
        }
        break;
      // 'regenerate' needs the LLM — handled by application/refine.ts.
      default:
        break;
    }
  }
  return { ...course, modules };
}

/** A module or lesson located by nodeId, with the fields relevant to regenerating it. */
export interface RefineTarget {
  kind: "module" | "lesson";
  currentTitle: string;
  currentSummary?: string; // modules only
  currentObjectives?: string[]; // lessons only
}

/** Locate the module or lesson a 'regenerate' edit targets. Pure, no I/O. */
export function findRefineTarget(
  course: Course,
  nodeId: string,
): RefineTarget | undefined {
  const module = course.modules.find((m) => m.id === nodeId);
  if (module)
    return {
      kind: "module",
      currentTitle: module.title,
      currentSummary: module.summary,
    };

  for (const m of course.modules) {
    const lesson = m.lessons.find((l) => l.id === nodeId);
    if (lesson)
      return {
        kind: "lesson",
        currentTitle: lesson.title,
        currentObjectives: lesson.objectives,
      };
  }
  return undefined;
}

export interface RefineResult {
  title?: string;
  summary?: string;
  objectives?: string[];
}

/**
 * Parse an LLM response for a 'regenerate' edit into the fields to apply. Falls back to
 * treating the raw text as the new title when it isn't parseable JSON (e.g. MockLlmProvider's
 * canned string) — a regenerate loop shouldn't fail just because a response wasn't structured.
 */
export function parseRefineResponse(raw: string): RefineResult {
  try {
    const parsed = extractJsonObject(raw) as Record<string, unknown>;
    return {
      title:
        typeof parsed.title === "string" && parsed.title.trim()
          ? parsed.title
          : undefined,
      summary: typeof parsed.summary === "string" ? parsed.summary : undefined,
      objectives: Array.isArray(parsed.objectives)
        ? parsed.objectives.filter((o): o is string => typeof o === "string")
        : undefined,
    };
  } catch {
    return { title: raw.trim().slice(0, 120) };
  }
}

/** Apply a regenerated node's new fields back into the course tree. Pure, no I/O. */
export function applyRegeneratedNode(
  course: Course,
  nodeId: string,
  result: RefineResult,
): Course {
  const modules = course.modules.map((m) => {
    if (m.id === nodeId) {
      return {
        ...m,
        ...(result.title ? { title: result.title } : {}),
        ...(result.summary ? { summary: result.summary } : {}),
      };
    }
    return {
      ...m,
      lessons: m.lessons.map((l) => {
        if (l.id !== nodeId) return l;
        return {
          ...l,
          ...(result.title ? { title: result.title } : {}),
          ...(result.objectives ? { objectives: result.objectives } : {}),
        };
      }),
    };
  });
  return { ...course, modules };
}
