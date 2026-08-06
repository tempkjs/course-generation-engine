"use client";
import type { Course } from "@/contracts";
import styles from "./studio.module.css";

interface CurriculumTreeProps {
  course: Course;
  busy: boolean;
  regeneratingNodeId: string | null;
  instructionDraft: string;
  onInstructionDraftChange: (value: string) => void;
  onStartRegenerate: (nodeId: string) => void;
  onCancelRegenerate: () => void;
  onConfirmRegenerate: (nodeId: string) => void;
  onRemove: (nodeId: string) => void;
}

/** Remove/regenerate controls, shared by module and lesson rows. */
function NodeActions({
  nodeId,
  busy,
  regeneratingNodeId,
  onStartRegenerate,
  onRemove,
}: {
  nodeId: string;
  busy: boolean;
  regeneratingNodeId: string | null;
  onStartRegenerate: (nodeId: string) => void;
  onRemove: (nodeId: string) => void;
}) {
  return (
    <div className={styles.actions}>
      <button
        type="button"
        className={`${styles.buttonSecondary} ${styles.buttonSmall}`}
        disabled={busy || regeneratingNodeId === nodeId}
        onClick={() => onStartRegenerate(nodeId)}
      >
        Regenerate
      </button>
      <button
        type="button"
        className={`${styles.buttonDanger} ${styles.buttonSmall}`}
        disabled={busy}
        onClick={() => onRemove(nodeId)}
      >
        Remove
      </button>
    </div>
  );
}

function InstructionBox({
  nodeId,
  busy,
  instructionDraft,
  onInstructionDraftChange,
  onCancelRegenerate,
  onConfirmRegenerate,
}: {
  nodeId: string;
  busy: boolean;
  instructionDraft: string;
  onInstructionDraftChange: (value: string) => void;
  onCancelRegenerate: () => void;
  onConfirmRegenerate: (nodeId: string) => void;
}) {
  return (
    <div className={styles.instructionRow}>
      <input
        type="text"
        autoFocus
        placeholder="Optional steering instruction (e.g. 'make this more hands-on')"
        value={instructionDraft}
        onChange={(e) => onInstructionDraftChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") onConfirmRegenerate(nodeId);
          if (e.key === "Escape") onCancelRegenerate();
        }}
      />
      <button
        type="button"
        className={`${styles.button} ${styles.buttonSmall}`}
        disabled={busy}
        onClick={() => onConfirmRegenerate(nodeId)}
      >
        Send
      </button>
      <button
        type="button"
        className={`${styles.buttonSecondary} ${styles.buttonSmall}`}
        disabled={busy}
        onClick={onCancelRegenerate}
      >
        Cancel
      </button>
    </div>
  );
}

export function CurriculumTree({
  course,
  busy,
  regeneratingNodeId,
  instructionDraft,
  onInstructionDraftChange,
  onStartRegenerate,
  onCancelRegenerate,
  onConfirmRegenerate,
  onRemove,
}: CurriculumTreeProps) {
  return (
    <div>
      {course.modules.map((module) => (
        <div key={module.id} className={styles.module}>
          <div className={styles.moduleHead}>
            <div>
              <div className={styles.moduleTitle}>
                Module {module.order}: {module.title}
              </div>
              <div className={styles.moduleSummary}>{module.summary}</div>
            </div>
            <NodeActions
              nodeId={module.id}
              busy={busy}
              regeneratingNodeId={regeneratingNodeId}
              onStartRegenerate={onStartRegenerate}
              onRemove={onRemove}
            />
          </div>
          {regeneratingNodeId === module.id && (
            <InstructionBox
              nodeId={module.id}
              busy={busy}
              instructionDraft={instructionDraft}
              onInstructionDraftChange={onInstructionDraftChange}
              onCancelRegenerate={onCancelRegenerate}
              onConfirmRegenerate={onConfirmRegenerate}
            />
          )}

          {module.lessons.map((lesson) => (
            <div key={lesson.id} className={styles.lesson}>
              <div className={styles.lessonMeta}>
                <div className={styles.lessonTitleRow}>
                  <span className={styles.lessonTitle}>
                    {module.order}.{lesson.order} {lesson.title}
                  </span>
                  <span
                    className={`${styles.badge} ${lesson.delivery === "async" ? styles.badgeAsync : ""}`}
                  >
                    {lesson.delivery}
                  </span>
                </div>
                {lesson.objectives.length > 0 && (
                  <ul className={styles.objectives}>
                    {lesson.objectives.map((o) => (
                      <li key={o}>{o}</li>
                    ))}
                  </ul>
                )}
                {regeneratingNodeId === lesson.id && (
                  <InstructionBox
                    nodeId={lesson.id}
                    busy={busy}
                    instructionDraft={instructionDraft}
                    onInstructionDraftChange={onInstructionDraftChange}
                    onCancelRegenerate={onCancelRegenerate}
                    onConfirmRegenerate={onConfirmRegenerate}
                  />
                )}
              </div>
              <NodeActions
                nodeId={lesson.id}
                busy={busy}
                regeneratingNodeId={regeneratingNodeId}
                onStartRegenerate={onStartRegenerate}
                onRemove={onRemove}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
