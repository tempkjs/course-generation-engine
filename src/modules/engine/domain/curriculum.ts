// Pure domain: status transitions + applying edits to a curriculum tree. No I/O.
import type { Course, CourseStatus, Module, Lesson, GenerateRequest } from '@/contracts';
import type { Edit } from '@/contracts';

const ORDER: CourseStatus[] = ['generating', 'draft', 'validated', 'published'];
export function canTransition(from: CourseStatus, to: CourseStatus): boolean {
  return ORDER.indexOf(to) === ORDER.indexOf(from) + 1; // never skip states
}

/** ADR 0004 / invariant 3: generateArtefacts (Phase 2) is forbidden pre-approval. */
export function assertValidatedForArtefacts(course: Course | undefined): void {
  if (!course || course.status !== 'validated') {
    throw new Error(
      `generateArtefacts is forbidden unless course.status === 'validated' (ADR 0004) — got '${course?.status ?? 'unknown course'}'`,
    );
  }
}

/** Parse + validate the Phase-1 LLM response into a Course, coercing status to 'draft'. */
export function parseCurriculumResponse(raw: string, req: GenerateRequest): Course {
  const parsed = extractJsonObject(raw);
  const record = parsed as Record<string, unknown>;

  const title = typeof record.title === 'string' && record.title.trim() ? record.title : req.topic;
  const rawModules = record.modules;
  if (!Array.isArray(rawModules) || rawModules.length === 0) {
    throw new Error('Curriculum LLM response is missing a non-empty "modules" array');
  }

  const slug = req.topic.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-+|-+$)/g, '');
  const id = `course-${slug || 'untitled'}-${Math.random().toString(36).slice(2, 8)}`;

  const modules: Module[] = rawModules.map((rawModule, moduleIndex) => {
    if (typeof rawModule !== 'object' || rawModule === null) {
      throw new Error(`Curriculum module at index ${moduleIndex} is not an object`);
    }
    const mod = rawModule as Record<string, unknown>;
    const moduleOrder = typeof mod.order === 'number' ? mod.order : moduleIndex + 1;
    const moduleTitle = typeof mod.title === 'string' && mod.title.trim() ? mod.title : `Module ${moduleOrder}`;
    const summary = typeof mod.summary === 'string' ? mod.summary : '';
    const moduleId = `${id}-m${moduleOrder}`;

    const rawLessons = mod.lessons;
    if (!Array.isArray(rawLessons) || rawLessons.length === 0) {
      throw new Error(`Curriculum module "${moduleTitle}" has no lessons`);
    }
    const lessons: Lesson[] = rawLessons.map((rawLesson, lessonIndex) => {
      if (typeof rawLesson !== 'object' || rawLesson === null) {
        throw new Error(`Lesson at index ${lessonIndex} in module "${moduleTitle}" is not an object`);
      }
      const lesson = rawLesson as Record<string, unknown>;
      const lessonOrder = typeof lesson.order === 'number' ? lesson.order : lessonIndex + 1;
      const lessonTitle =
        typeof lesson.title === 'string' && lesson.title.trim() ? lesson.title : `Lesson ${moduleOrder}.${lessonOrder}`;
      const objectives = Array.isArray(lesson.objectives)
        ? lesson.objectives.filter((o): o is string => typeof o === 'string')
        : [];
      const delivery: Lesson['delivery'] = lesson.delivery === 'live' ? 'live' : 'async';
      return {
        id: `${moduleId}-l${lessonOrder}`,
        order: lessonOrder,
        title: lessonTitle,
        objectives,
        delivery,
        artefacts: [],
      };
    });

    return { id: moduleId, order: moduleOrder, title: moduleTitle, summary, lessons };
  });

  return {
    id,
    status: 'draft', // coerced regardless of what the model returned (ADR 0004 ladder starts here)
    title,
    field: req.field,
    level: req.level,
    practitionerId: req.practitionerId,
    priceBand: 'standard',
    cadence: req.cadence,
    sourceRefs: [],
    modules,
    createdAt: new Date().toISOString(),
  };
}

function extractJsonObject(raw: string): unknown {
  const trimmed = raw.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf('{');
    const end = trimmed.lastIndexOf('}');
    if (start === -1 || end === -1 || end <= start) {
      throw new Error('Curriculum LLM response did not contain a parseable JSON object');
    }
    return JSON.parse(trimmed.slice(start, end + 1));
  }
}

/** Apply practitioner edits (add/remove/update/regenerate) to a course's module/lesson tree. */
export function applyEdits(course: Course, edits: Edit[]): Course {
  let modules = course.modules;
  for (const edit of edits) {
    switch (edit.op) {
      case 'remove':
        modules = modules
          .filter((m) => m.id !== edit.nodeId)
          .map((m) => ({ ...m, lessons: m.lessons.filter((l) => l.id !== edit.nodeId) }));
        break;
      case 'update':
        modules = modules.map((m) =>
          m.id === edit.nodeId && edit.patch.title ? { ...m, title: edit.patch.title } : m,
        );
        break;
      // 'add' and 'regenerate' need the orchestrator (they may call the LLM) — handled there.
      default:
        break;
    }
  }
  return { ...course, modules };
}
