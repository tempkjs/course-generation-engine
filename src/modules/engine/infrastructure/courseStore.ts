import type { Course } from '@/contracts';

// Seam-4 mock: a PROCESS-LEVEL in-memory course store, shared by every CourseEngine
// instance in this process (Mock and Live alike). `getCourseEngine()` (application/
// orchestrator.ts) returns a NEW engine instance per call, so state kept on `this` inside
// MockCourseEngine/LiveCourseEngine does not survive across the separate generate/refine/
// approve/generateArtefacts HTTP requests a practitioner session makes — each request gets
// its own instance. A module-level singleton does survive, because Node caches the module.
//
// This is BUILD-layer state (a `Course` in progress), kept separate from the SOURCE
// knowledge cache (Seam 3) per the source/build split (invariant 4). Real Supabase (Seam 4)
// replaces this store with persistent rows behind the same get/put shape; nothing above it
// changes when that swap happens (§7 of the integration contract).
const courses = new Map<string, Course>();

export function getCourse(courseId: string): Course | undefined {
  return courses.get(courseId);
}

export function putCourse(course: Course): Course {
  courses.set(course.id, course);
  return course;
}

export function requireCourse(courseId: string): Course {
  const course = courses.get(courseId);
  if (!course) throw new Error(`No course found for id "${courseId}"`);
  return course;
}
