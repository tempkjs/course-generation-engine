"use client";
import type { Course } from "@/contracts";
import { canRegenerate, HANDOFF_MESSAGE, type RegenCounts } from "./regenCap";
import styles from "./studio.module.css";

interface CurriculumTreeProps {
  course: Course;
  busy: boolean;
  regeneratingNodeId: string | null;
  instructionDraft: string;
  regenCounts: RegenCounts;
  feedbackDraftByNode: Record<string, string>;
  feedbackSubmittedNodes: Record<string, boolean>;
  onInstructionDraftChange: (value: string) => void;
  onStartRegenerate: (nodeId: string) => void;
  onCancelRegenerate: () => void;
  onConfirmRegenerate: (nodeId: string) => void;
  onRemove: (nodeId: string) => void;
  onFeedbackDraftChange: (nodeId: string, value: string) => void;
  onSubmitFeedback: (nodeId: string) => void;
}

/** Remove/regenerate controls, shared by module and lesson rows. */
function NodeActions({
  nodeId,
  busy,
  regeneratingNodeId,
  capped,
  onStartRegenerate,
  onRemove,
}: {
  nodeId: string;
  busy: boolean;
  regeneratingNodeId: string | null;
  capped: boolean;
  onStartRegenerate: (nodeId: string) => void;
  onRemove: (nodeId: string) => void;
}) {
  return (
    <div className={styles.actions}>
      <button
        type="button"
        className={`${styles.buttonSecondary} ${styles.buttonSmall}`}
        disabled={busy || regeneratingNodeId === nodeId || capped}
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

/** Shown once a node hits its regenerate cap (src/app/studio/regenCap.ts) — the graceful
 * hand-off: stop offering more machine attempts, capture feedback instead. */
function HandoffBox({
  nodeId,
  busy,
  feedbackDraft,
  submitted,
  onFeedbackDraftChange,
  onSubmitFeedback,
}: {
  nodeId: string;
  busy: boolean;
  feedbackDraft: string;
  submitted: boolean;
  onFeedbackDraftChange: (nodeId: string, value: string) => void;
  onSubmitFeedback: (nodeId: string) => void;
}) {
  if (submitted) {
    return (
      <div className={styles.handoff}>
        <p className={styles.handoffMessage}>
          Thanks — your feedback was recorded.
        </p>
      </div>
    );
  }
  return (
    <div className={styles.handoff}>
      <p className={styles.handoffMessage}>{HANDOFF_MESSAGE}</p>
      <textarea
        rows={3}
        placeholder="What went wrong, what you tried, what you expected instead…"
        value={feedbackDraft}
        onChange={(e) => onFeedbackDraftChange(nodeId, e.target.value)}
      />
      <button
        type="button"
        className={`${styles.button} ${styles.buttonSmall}`}
        disabled={busy || !feedbackDraft.trim()}
        onClick={() => onSubmitFeedback(nodeId)}
      >
        Submit feedback
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
  regenCounts,
  feedbackDraftByNode,
  feedbackSubmittedNodes,
  onInstructionDraftChange,
  onStartRegenerate,
  onCancelRegenerate,
  onConfirmRegenerate,
  onRemove,
  onFeedbackDraftChange,
  onSubmitFeedback,
}: CurriculumTreeProps) {
  return (
    <div>
      {course.modules.map((module) => {
        const moduleCapped = !canRegenerate(regenCounts, module.id);
        return (
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
                capped={moduleCapped}
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
            {moduleCapped && (
              <HandoffBox
                nodeId={module.id}
                busy={busy}
                feedbackDraft={feedbackDraftByNode[module.id] ?? ""}
                submitted={feedbackSubmittedNodes[module.id] ?? false}
                onFeedbackDraftChange={onFeedbackDraftChange}
                onSubmitFeedback={onSubmitFeedback}
              />
            )}

            {module.lessons.map((lesson) => {
              const lessonCapped = !canRegenerate(regenCounts, lesson.id);
              return (
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
                    {lessonCapped && (
                      <HandoffBox
                        nodeId={lesson.id}
                        busy={busy}
                        feedbackDraft={feedbackDraftByNode[lesson.id] ?? ""}
                        submitted={feedbackSubmittedNodes[lesson.id] ?? false}
                        onFeedbackDraftChange={onFeedbackDraftChange}
                        onSubmitFeedback={onSubmitFeedback}
                      />
                    )}
                  </div>
                  <NodeActions
                    nodeId={lesson.id}
                    busy={busy}
                    regeneratingNodeId={regeneratingNodeId}
                    capped={lessonCapped}
                    onStartRegenerate={onStartRegenerate}
                    onRemove={onRemove}
                  />
                </div>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}
