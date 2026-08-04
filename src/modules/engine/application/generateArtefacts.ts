// Phase-2 artefact generation use-case: composes domain planning, the LLM seam (Seam 2), and
// the process-level content store (Seam-4 mock) into real, style-conditioned artefact
// content. Shared by MockCourseEngine and LiveCourseEngine — AI_MODE decides which
// LlmProvider getLlmProvider() resolves to; this file doesn't know or care (same pattern as
// application/refine.ts).
import type { Artefact, ArtefactType, Course, StyleProfile } from "@/contracts";
import { getLlmProvider } from "@/modules/llm";
import { buildArtefactPrompt } from "../prompts/artefacts.v1";
import {
  attachArtefact,
  planArtefactTargets,
  SUPPORTED_ARTEFACT_TYPES,
} from "../domain/artefacts";
import { putContent } from "../infrastructure/contentStore";

function notYetSupportedContent(
  type: ArtefactType,
  lessonTitle: string,
): string {
  return `[not yet supported] Artefact type "${type}" has no Phase-2 generator yet (see prompts/artefacts.v1.ts SUPPORTED_ARTEFACT_TYPES). Requested for lesson "${lessonTitle}".`;
}

export interface GenerateArtefactsResult {
  course: Course;
  artefacts: Artefact[];
}

export async function generateArtefactsForCourse(
  course: Course,
  prefs: ArtefactType[],
  style: StyleProfile,
): Promise<GenerateArtefactsResult> {
  const targets = planArtefactTargets(course, prefs);

  // Deterministic per-(lesson,type) numbering: seeded from artefacts already on the lesson
  // (so repeat generateArtefacts calls don't collide with earlier ones) and incremented as
  // this call proceeds (so two targets for the same lesson+type within one call don't
  // collide with each other either). Keeps contentRef/id unique without random ids.
  const nextIndex = new Map<string, number>();
  function takeIndex(
    lessonId: string,
    type: ArtefactType,
    seed: number,
  ): number {
    const key = `${lessonId}:${type}`;
    const current = nextIndex.get(key) ?? seed;
    nextIndex.set(key, current + 1);
    return current;
  }

  let nextCourse = course;
  const artefacts: Artefact[] = [];

  for (const { lesson, type } of targets) {
    const seed = lesson.artefacts.filter((a) => a.type === type).length;
    const index = takeIndex(lesson.id, type, seed);
    const contentRef = `content://${course.id}/${lesson.id}/${type}/${index}`;

    const content = SUPPORTED_ARTEFACT_TYPES.has(type)
      ? await getLlmProvider().generate(
          buildArtefactPrompt({
            type,
            courseTitle: course.title,
            field: course.field,
            lessonTitle: lesson.title,
            lessonObjectives: lesson.objectives,
            style,
          }),
        )
      : notYetSupportedContent(type, lesson.title);

    putContent(contentRef, content);

    const artefact: Artefact = {
      id: `${lesson.id}-${type}-${index}`,
      type,
      contentRef,
      generatedBy: "engine",
      approved: false,
    };
    artefacts.push(artefact);
    nextCourse = attachArtefact(nextCourse, lesson.id, artefact);
  }

  return { course: nextCourse, artefacts };
}
