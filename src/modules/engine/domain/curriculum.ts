// Pure domain: status transitions + applying edits to a curriculum tree. No I/O.
import type { Course, CourseStatus, Module, Lesson } from '@/contracts';
import type { Edit } from '@/contracts';

const ORDER: CourseStatus[] = ['generating', 'draft', 'validated', 'published'];
export function canTransition(from: CourseStatus, to: CourseStatus): boolean {
  return ORDER.indexOf(to) === ORDER.indexOf(from) + 1; // never skip states
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
