import type { LmsAdapter } from "@/contracts";
import { MockLmsAdapter } from "./infrastructure/mockLms";
export type { LmsAdapter };
// TODO(seam-5, live): Frappe/Moodle adapter behind this same interface.
export function getLmsAdapter(): LmsAdapter {
  return new MockLmsAdapter();
}
