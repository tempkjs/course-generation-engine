// Seam 5 — App <-> LMS. Link out; never become the LMS.
import type { Course } from "./data";
export interface LmsAdapter {
  publishCourse(course: Course): Promise<{ lmsCourseId: string }>;
}
