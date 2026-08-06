"use client";
import type { VerificationChecklist as Checklist } from "@/modules/engine";
import styles from "./studio.module.css";

const TYPE_LABEL: Record<string, string> = {
  citation: "Citation",
  date: "Date",
  unsettled: "Unsettled",
  figure: "Figure",
  product: "Product",
  "other-nonstatic": "Other",
};

/**
 * The sophistication moment (ADR 0013): every non-static claim the generator flagged in the
 * SAME call that produced the content, surfaced as an actionable worklist — never implying
 * the unflagged remainder is safe (see the ADR's "checklist, not a warning" framing).
 */
export function VerificationChecklist({ checklist }: { checklist: Checklist }) {
  return (
    <div className={styles.checklistPanel}>
      <div className={styles.checklistHead}>
        <span className={styles.checklistCount}>{checklist.totalClaims}</span>
        <span className={styles.checklistLabel}>
          {checklist.totalClaims === 1
            ? "claim needs your verification"
            : "claims need your verification"}
        </span>
      </div>
      <div className={styles.checklistNote}>
        Flagged by claim type, not by confidence — this list is not exhaustive.
        The rest of the content still relies on your professional judgment.
      </div>

      {checklist.totalClaims > 0 && (
        <>
          <div className={styles.checklistByType}>
            {Object.entries(checklist.byType).map(([type, count]) => (
              <span key={type} className={styles.checklistTypeBadge}>
                {TYPE_LABEL[type] ?? type}: {count}
              </span>
            ))}
          </div>
          <div className={styles.claimList}>
            {checklist.claims.map((claim, i) => (
              <div key={`${claim.type}-${i}`} className={styles.claim}>
                <span className={styles.claimType}>
                  {TYPE_LABEL[claim.type] ?? claim.type}
                </span>
                <div className={styles.claimText}>
                  &ldquo;{claim.text}&rdquo;
                </div>
                {claim.note && (
                  <div className={styles.claimNote}>{claim.note}</div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
