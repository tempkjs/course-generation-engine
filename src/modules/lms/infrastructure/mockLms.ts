import type { LmsAdapter, Course } from "@/contracts";
export class MockLmsAdapter implements LmsAdapter {
  async publishCourse(course: Course): Promise<{ lmsCourseId: string }> {
    return { lmsCourseId: `mock-lms-${course.id}` };
  }
}
