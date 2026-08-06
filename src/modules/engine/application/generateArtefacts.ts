// Phase-2 artefact generation use-case: composes domain planning, the LLM seam (Seam 2), and
// the process-level content store (Seam-4 mock) into real, style-conditioned artefact
// content. Shared by MockCourseEngine and LiveCourseEngine — AI_MODE decides which
// LlmProvider getLlmProvider() resolves to; this file doesn't know or care (same pattern as
// application/refine.ts).
import type {
  Artefact,
  ArtefactType,
  Course,
  FlaggedClaim,
  StyleProfile,
} from "@/contracts";
import { getLlmProvider } from "@/modules/llm";
import { buildArtefactPrompt } from "../prompts/artefacts.v3";
import {
  attachArtefact,
  parseArtefactResponse,
  planArtefactTargets,
  SUPPORTED_ARTEFACT_TYPES,
} from "../domain/artefacts";
import { putContent } from "../infrastructure/contentStore";

function notYetSupportedContent(
  type: ArtefactType,
  lessonTitle: string,
): string {
  return `[not yet supported] Artefact type "${type}" has no Phase-2 generator yet (see domain/artefacts.ts SUPPORTED_ARTEFACT_TYPES). Requested for lesson "${lessonTitle}".`;
}

export interface GenerateArtefactsResult {
  course: Course;
  artefacts: Artefact[];
}

export async function generateArtefactsForCourse(
  course: Course,
  prefs: ArtefactType[],
  style: StyleProfile,
  lessonIds?: string[],
): Promise<GenerateArtefactsResult> {
  // ADR 0014 (v0.5): omitted => every lesson (unchanged default); [] is a caller error —
  // "regenerate nothing" is never what's meant, and silently no-op-ing would be confusing.
  if (lessonIds && lessonIds.length === 0) {
    throw new Error(
      "generateArtefacts: opts.lessonIds was an empty array — omit opts.lessonIds entirely to target every lesson, or provide at least one lesson id",
    );
  }
  const targets = planArtefactTargets(course, prefs, lessonIds);

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

    let content: string;
    let flaggedClaims: FlaggedClaim[];
    if (SUPPORTED_ARTEFACT_TYPES.has(type)) {
      const raw = await getLlmProvider().generate(
        buildArtefactPrompt({
          type,
          courseTitle: course.title,
          field: course.field,
          lessonTitle: lesson.title,
          lessonObjectives: lesson.objectives,
          style,
          jurisdiction: course.jurisdiction,
        }),
      );
      // The artefacts prompt returns { content, flaggedClaims } in one call (ADR 0013) —
      // flags live on the Artefact, never inside the stored content blob.
      ({ content, flaggedClaims } = parseArtefactResponse(raw));
    } else {
      content = notYetSupportedContent(type, lesson.title);
      flaggedClaims = []; // a placeholder stub makes no claims to flag
    }

    putContent(contentRef, content);

    const artefact: Artefact = {
      id: `${lesson.id}-${type}-${index}`,
      type,
      contentRef,
      generatedBy: "engine",
      approved: false,
      flaggedClaims,
    };
    artefacts.push(artefact);
    nextCourse = attachArtefact(nextCourse, lesson.id, artefact);
  }

  return { course: nextCourse, artefacts };
}
