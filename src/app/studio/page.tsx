"use client";
// /studio — a minimal, brand-credible practitioner demo page for live screen-shares.
// A WORKING TOOL, not a product: the flow is the point, not visual polish. Reuses the exact
// Seam 1 client (CourseEngineClient) the real Swakojo Academy website will use — no engine
// internals imported here (ENGINEERING_HANDBOOK.md §7 / integration-contract.md Rule B).
import { useEffect, useMemo, useState } from "react";
import { Poppins } from "next/font/google";
import {
  CourseEngineClient,
  buildVerificationChecklist,
  fetchArtefactContent,
} from "@/modules/engine";
import type {
  Artefact,
  ArtefactType,
  Course,
  Field,
  Level,
  StyleProfile,
} from "@/contracts";
import { CurriculumTree } from "./CurriculumTree";
import { VerificationChecklist } from "./VerificationChecklist";
import { TONE_TEXT } from "./theme";
import {
  DEFAULT_CATALOG_COURSE_TITLE,
  DEFAULT_CATALOG_FIELD,
  catalogEntryToRequestFields,
  findCatalogCourse,
  getCatalogCourses,
  getCatalogFields,
} from "@/config/demo-catalog";
import { buildArtefactScope } from "./artefactRequest";
import {
  artefactRegenKey,
  canRegenerate,
  HANDOFF_MESSAGE,
  recordRegen,
  type RegenCounts,
} from "./regenCap";
import styles from "./studio.module.css";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const client = new CourseEngineClient();
const PRACTITIONER_ID = "p-studio-demo";
const CADENCE = "weekend-2x2";
const ARTEFACT_PREFS: ArtefactType[] = ["textual", "slide"];

// `next dev` only compiles an API route the first time it's HIT (any method) — and that
// first compile resets the shared courseStore/contentStore singletons (see
// next.config.mjs's onDemandEntries comment for the other half of this fix). A GET forces
// the same on-demand compile as the real POST would, returns a harmless 405 without
// touching the handler body, and — critically — never reaches the engine, so this can't
// fire a real (costly) live LLM call. Fired once on mount so every route is warm before the
// practitioner's first real click.
const WARM_UP_ROUTES = [
  "/api/generate-curriculum",
  "/api/refine-curriculum",
  "/api/approve-curriculum",
  "/api/generate-artefacts",
  "/api/artefact-content",
];

interface FormState {
  field: Field;
  courseTitle: string; // selected catalog course title — drives GenerateRequest.topic
  jurisdiction: string;
  level: Level;
  durationWeeks: number;
  tone: "plain" | "rigorous";
  depth: StyleProfile["depth"];
  modalities: ArtefactType[];
}

// Selecting a field or a course sets topic + level + jurisdiction + durationWeeks together
// from the catalog entry (src/config/demo-catalog.ts) — practitioners can only generate
// courses from that curated list (demo/early-release control).
function applyCatalogSelection(
  form: FormState,
  field: Field,
  courseTitle: string,
): FormState {
  const entry = findCatalogCourse(field, courseTitle);
  if (!entry) return { ...form, field, courseTitle };
  const picked = catalogEntryToRequestFields(entry);
  return {
    ...form,
    field,
    courseTitle,
    level: picked.level,
    jurisdiction: picked.jurisdiction ?? "",
    durationWeeks: picked.durationWeeks,
  };
}

const INITIAL_FORM: FormState = applyCatalogSelection(
  {
    field: DEFAULT_CATALOG_FIELD,
    courseTitle: DEFAULT_CATALOG_COURSE_TITLE,
    jurisdiction: "",
    level: "medium",
    durationWeeks: 5,
    tone: "plain",
    depth: "working",
    modalities: ["textual", "slide"],
  },
  DEFAULT_CATALOG_FIELD,
  DEFAULT_CATALOG_COURSE_TITLE,
);

// Stopgap durable logging (not part of Seam 1 — see src/app/api/regen-log and
// src/app/api/feedback). Fire-and-forget, same "never block the UI on a log write" posture as
// Seam 6 (EventSink).
function logRegeneration(
  courseId: string,
  nodeId: string,
  kind: "curriculum" | "artefact",
  instruction: string | undefined,
): void {
  fetch("/api/regen-log", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ courseId, nodeId, kind, instruction }),
  }).catch(() => {});
}

function submitFeedbackLog(
  courseId: string,
  nodeId: string,
  instructionsTried: string[],
  feedback: string,
): Promise<void> {
  return fetch("/api/feedback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ courseId, nodeId, instructionsTried, feedback }),
  })
    .then(() => undefined)
    .catch(() => {});
}

function flattenLessons(course: Course) {
  return course.modules.flatMap((m) =>
    m.lessons.map((l) => ({
      id: l.id,
      label: `${m.order}.${l.order} — ${l.title}`,
    })),
  );
}

function Spinner({ label }: { label: string }) {
  return (
    <span className={styles.spinner}>
      <span className={styles.dot} />
      {label}
    </span>
  );
}

export default function StudioPage() {
  const [form, setForm] = useState<FormState>(INITIAL_FORM);
  const [course, setCourse] = useState<Course | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [regeneratingNodeId, setRegeneratingNodeId] = useState<string | null>(
    null,
  );
  const [instructionDraft, setInstructionDraft] = useState("");

  // Per-node regenerate cap (session-scoped, in-memory) + graceful hand-off state. Shared
  // across curriculum node regenerate and per-lesson artefact regenerate — see
  // src/app/studio/regenCap.ts for the disjoint key namespaces.
  const [regenCounts, setRegenCounts] = useState<RegenCounts>({});
  const [instructionsTriedByNode, setInstructionsTriedByNode] = useState<
    Record<string, string[]>
  >({});
  const [feedbackDraftByNode, setFeedbackDraftByNode] = useState<
    Record<string, string>
  >({});
  const [feedbackSubmittedNodes, setFeedbackSubmittedNodes] = useState<
    Record<string, boolean>
  >({});

  const [selectedLessonId, setSelectedLessonId] = useState<string>("");
  const [artefacts, setArtefacts] = useState<Artefact[]>([]);
  const [contentByArtefactId, setContentByArtefactId] = useState<
    Record<string, string>
  >({});

  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    for (const path of WARM_UP_ROUTES) {
      fetch(path, { method: "GET" }).catch(() => {});
    }
  }, []);

  const styleProfile: StyleProfile = useMemo(
    () => ({
      practitionerId: PRACTITIONER_ID,
      modalities: form.modalities,
      tone: TONE_TEXT[form.tone] ?? form.tone,
      depth: form.depth,
    }),
    [form.modalities, form.tone, form.depth],
  );

  const lessons = course ? flattenLessons(course) : [];
  const checklist =
    artefacts.length > 0 ? buildVerificationChecklist(artefacts) : null;

  async function run<T>(
    label: string,
    fn: () => Promise<T>,
  ): Promise<T | undefined> {
    setError(null);
    setBusy(label);
    try {
      return await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return undefined;
    } finally {
      setBusy(null);
    }
  }

  async function handleGenerateCurriculum() {
    const c = await run("Generating curriculum…", () =>
      client.generateCurriculum({
        topic: form.courseTitle,
        field: form.field,
        jurisdiction: form.jurisdiction || undefined,
        level: form.level,
        audienceExperience: "",
        durationWeeks: form.durationWeeks,
        cadence: CADENCE,
        practitionerId: PRACTITIONER_ID,
        style: styleProfile,
      }),
    );
    if (c) {
      setCourse(c);
      setArtefacts([]);
      setContentByArtefactId({});
      setSelectedLessonId("");
      // Fresh course = fresh node ids — the old caps/feedback state can't apply to them.
      setRegenCounts({});
      setInstructionsTriedByNode({});
      setFeedbackDraftByNode({});
      setFeedbackSubmittedNodes({});
    }
  }

  async function handleRemove(nodeId: string) {
    if (!course) return;
    const c = await run("Removing…", () =>
      client.refineCurriculum(course.id, [{ op: "remove", nodeId }]),
    );
    if (c) setCourse(c);
  }

  function startRegenerate(nodeId: string) {
    setRegeneratingNodeId(nodeId);
    setInstructionDraft("");
  }

  function cancelRegenerate() {
    setRegeneratingNodeId(null);
    setInstructionDraft("");
  }

  async function confirmRegenerate(nodeId: string) {
    if (!course) return;
    if (!canRegenerate(regenCounts, nodeId)) return; // cap already hit — UI hides this control
    const instruction = instructionDraft.trim() || undefined;
    const c = await run("Regenerating…", () =>
      client.refineCurriculum(course.id, [
        { op: "regenerate", nodeId, instruction },
      ]),
    );
    if (c) {
      setCourse(c);
      setRegeneratingNodeId(null);
      setInstructionDraft("");
      logRegeneration(course.id, nodeId, "curriculum", instruction);
      setRegenCounts((counts) => recordRegen(counts, nodeId));
      setInstructionsTriedByNode((byNode) => ({
        ...byNode,
        [nodeId]: [
          ...(byNode[nodeId] ?? []),
          instruction ?? "(no instruction)",
        ],
      }));
    }
  }

  async function handleSubmitFeedback(nodeId: string) {
    if (!course) return;
    const feedback = (feedbackDraftByNode[nodeId] ?? "").trim();
    if (!feedback) return;
    await submitFeedbackLog(
      course.id,
      nodeId,
      instructionsTriedByNode[nodeId] ?? [],
      feedback,
    );
    setFeedbackSubmittedNodes((m) => ({ ...m, [nodeId]: true }));
  }

  async function handleApprove() {
    if (!course) return;
    const c = await run("Approving curriculum…", () =>
      client.approveCurriculum(course.id),
    );
    if (c) setCourse(c);
  }

  async function handleGenerateArtefacts() {
    if (!course || !selectedLessonId) return;
    const capKey = artefactRegenKey(selectedLessonId);
    if (!canRegenerate(regenCounts, capKey)) return; // cap hit — UI hides the control
    // Guardrail: always scoped to exactly this one lesson, never a whole-course fan-out
    // (the CA 48-call incident) — see src/app/studio/artefactRequest.ts.
    const generated = await run(
      "Generating material… (this can take up to a minute)",
      () =>
        client.generateArtefacts(
          course.id,
          ARTEFACT_PREFS,
          styleProfile,
          buildArtefactScope(selectedLessonId),
        ),
    );
    if (!generated) return;
    logRegeneration(course.id, selectedLessonId, "artefact", undefined);
    setRegenCounts((counts) => recordRegen(counts, capKey));
    setArtefacts(generated);
    const entries = await Promise.all(
      generated.map(
        async (a) => [a.id, await fetchArtefactContent(a.contentRef)] as const,
      ),
    );
    setContentByArtefactId(Object.fromEntries(entries));
  }

  const canApprove = course?.status === "draft";
  const canGenerateArtefacts = course?.status === "validated";
  const artefactCapKey = selectedLessonId
    ? artefactRegenKey(selectedLessonId)
    : null;
  const artefactCapped = artefactCapKey
    ? !canRegenerate(regenCounts, artefactCapKey)
    : false;

  return (
    <div className={`${poppins.className} ${styles.page}`}>
      <header className={styles.header}>
        <div>
          <span className={styles.wordmark}>Swakojo Academy</span>
          <span className={styles.wordmarkSub}>Studio</span>
        </div>
        <span className={styles.headerTag}>Live demo</span>
      </header>

      <main className={styles.main}>
        {error && <div className={styles.error}>{error}</div>}

        {/* Step 1 — input */}
        <section className={styles.section}>
          <h2 className={styles.stepHeading}>
            <span
              className={`${styles.stepNumber} ${course ? styles.stepNumberDone : ""}`}
            >
              1
            </span>
            Course brief
          </h2>

          <div className={styles.row}>
            <div className={styles.field}>
              <label htmlFor="catalog-field">Field</label>
              <select
                id="catalog-field"
                value={form.field}
                onChange={(e) => {
                  const field = e.target.value;
                  const firstTitle = getCatalogCourses(field)[0]?.title ?? "";
                  setForm((f) => applyCatalogSelection(f, field, firstTitle));
                }}
              >
                {getCatalogFields().map((f) => (
                  <option key={f} value={f}>
                    {f}
                  </option>
                ))}
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="catalog-course">Course</label>
              <select
                id="catalog-course"
                value={form.courseTitle}
                onChange={(e) =>
                  setForm((f) =>
                    applyCatalogSelection(f, f.field, e.target.value),
                  )
                }
              >
                {getCatalogCourses(form.field).map((c) => (
                  <option key={c.title} value={c.title}>
                    {c.title}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label htmlFor="jurisdiction">
                Jurisdiction (optional — blank means jurisdiction-neutral)
              </label>
              <input
                id="jurisdiction"
                type="text"
                placeholder="e.g. IN"
                value={form.jurisdiction}
                onChange={(e) =>
                  setForm({ ...form, jurisdiction: e.target.value })
                }
              />
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label htmlFor="level">Level</label>
              <select
                id="level"
                value={form.level}
                onChange={(e) =>
                  setForm({ ...form, level: e.target.value as Level })
                }
              >
                <option value="basic">Basic</option>
                <option value="medium">Medium</option>
                <option value="advanced">Advanced</option>
              </select>
            </div>
            <div className={styles.field}>
              <label htmlFor="duration">Duration (weeks)</label>
              <input
                id="duration"
                type="number"
                min={1}
                max={16}
                value={form.durationWeeks}
                onChange={(e) =>
                  setForm({
                    ...form,
                    durationWeeks: Number(e.target.value) || 1,
                  })
                }
              />
            </div>
          </div>

          <div className={styles.row}>
            <div className={styles.field}>
              <label>Tone</label>
              <div className={styles.radioGroup}>
                <label>
                  <input
                    type="radio"
                    name="tone"
                    checked={form.tone === "plain"}
                    onChange={() => setForm({ ...form, tone: "plain" })}
                  />
                  Plain
                </label>
                <label>
                  <input
                    type="radio"
                    name="tone"
                    checked={form.tone === "rigorous"}
                    onChange={() => setForm({ ...form, tone: "rigorous" })}
                  />
                  Rigorous
                </label>
              </div>
            </div>
            <div className={styles.field}>
              <label>Depth</label>
              <div className={styles.radioGroup}>
                {(["overview", "working", "deep"] as const).map((d) => (
                  <label key={d}>
                    <input
                      type="radio"
                      name="depth"
                      checked={form.depth === d}
                      onChange={() => setForm({ ...form, depth: d })}
                    />
                    {d}
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className={styles.field}>
            <label>Preferred modalities</label>
            <div className={styles.checkboxGroup}>
              {(["textual", "slide"] as const).map((m) => (
                <label key={m}>
                  <input
                    type="checkbox"
                    checked={form.modalities.includes(m)}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        modalities: e.target.checked
                          ? [...form.modalities, m]
                          : form.modalities.filter((x) => x !== m),
                      })
                    }
                  />
                  {m}
                </label>
              ))}
            </div>
          </div>

          <button
            type="button"
            className={styles.button}
            disabled={busy !== null || !form.courseTitle.trim()}
            onClick={handleGenerateCurriculum}
          >
            Generate curriculum
          </button>
          {busy === "Generating curriculum…" && (
            <div style={{ marginTop: 12 }}>
              <Spinner label={busy} />
            </div>
          )}
        </section>

        {/* Step 2 — curriculum review */}
        {course && (
          <section className={styles.section}>
            <h2 className={styles.stepHeading}>
              <span
                className={`${styles.stepNumber} ${canGenerateArtefacts ? styles.stepNumberDone : ""}`}
              >
                2
              </span>
              Review &amp; approve — &ldquo;{course.title}&rdquo;
            </h2>
            <p className={styles.hint}>
              Remove what doesn&rsquo;t belong, steer a regenerate with an
              instruction, then approve to unlock Phase 2.
            </p>

            <CurriculumTree
              course={course}
              busy={busy !== null}
              regeneratingNodeId={regeneratingNodeId}
              instructionDraft={instructionDraft}
              regenCounts={regenCounts}
              feedbackDraftByNode={feedbackDraftByNode}
              feedbackSubmittedNodes={feedbackSubmittedNodes}
              onInstructionDraftChange={setInstructionDraft}
              onStartRegenerate={startRegenerate}
              onCancelRegenerate={cancelRegenerate}
              onConfirmRegenerate={confirmRegenerate}
              onRemove={handleRemove}
              onFeedbackDraftChange={(nodeId, value) =>
                setFeedbackDraftByNode((m) => ({ ...m, [nodeId]: value }))
              }
              onSubmitFeedback={handleSubmitFeedback}
            />

            <div
              style={{
                marginTop: 16,
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <button
                type="button"
                className={styles.button}
                disabled={busy !== null || !canApprove}
                onClick={handleApprove}
              >
                {course.status === "validated"
                  ? "Curriculum approved"
                  : "Approve curriculum"}
              </button>
              {busy !== null && busy !== "Generating curriculum…" && (
                <Spinner label={busy} />
              )}
            </div>
          </section>
        )}

        {/* Step 3 — artefact generation */}
        {course && (
          <section
            className={`${styles.section} ${!canGenerateArtefacts ? styles.sectionMuted : ""}`}
          >
            <h2 className={styles.stepHeading}>
              <span
                className={`${styles.stepNumber} ${artefacts.length > 0 ? styles.stepNumberDone : ""}`}
              >
                3
              </span>
              Generate lesson material
            </h2>
            {!canGenerateArtefacts ? (
              <p className={styles.emptyState}>
                Approve the curriculum above to unlock this step.
              </p>
            ) : (
              <>
                <div className={styles.field}>
                  <label htmlFor="lesson">Lesson</label>
                  <select
                    id="lesson"
                    value={selectedLessonId}
                    onChange={(e) => setSelectedLessonId(e.target.value)}
                  >
                    <option value="">Select a lesson…</option>
                    {lessons.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  className={styles.button}
                  disabled={
                    busy !== null || !selectedLessonId || artefactCapped
                  }
                  onClick={handleGenerateArtefacts}
                >
                  Generate material
                </button>
                {busy ===
                  "Generating material… (this can take up to a minute)" && (
                  <div style={{ marginTop: 12 }}>
                    <Spinner label={busy} />
                  </div>
                )}
                {artefactCapped && artefactCapKey && (
                  <div className={styles.handoff} style={{ marginTop: 12 }}>
                    {feedbackSubmittedNodes[artefactCapKey] ? (
                      <p className={styles.handoffMessage}>
                        Thanks — your feedback was recorded.
                      </p>
                    ) : (
                      <>
                        <p className={styles.handoffMessage}>
                          {HANDOFF_MESSAGE}
                        </p>
                        <textarea
                          rows={3}
                          placeholder="What went wrong, what you tried, what you expected instead…"
                          value={feedbackDraftByNode[artefactCapKey] ?? ""}
                          onChange={(e) =>
                            setFeedbackDraftByNode((m) => ({
                              ...m,
                              [artefactCapKey]: e.target.value,
                            }))
                          }
                        />
                        <button
                          type="button"
                          className={`${styles.button} ${styles.buttonSmall}`}
                          disabled={
                            busy !== null ||
                            !(feedbackDraftByNode[artefactCapKey] ?? "").trim()
                          }
                          onClick={() => handleSubmitFeedback(artefactCapKey)}
                        >
                          Submit feedback
                        </button>
                      </>
                    )}
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* Step 4 — output */}
        {checklist && (
          <section className={styles.section}>
            <h2 className={styles.stepHeading}>
              <span className={`${styles.stepNumber} ${styles.stepNumberDone}`}>
                4
              </span>
              Material &amp; verification worklist
            </h2>

            <VerificationChecklist checklist={checklist} />

            <div className={styles.twoCol} style={{ marginTop: 20 }}>
              {artefacts.map((a) => (
                <div key={a.id} className={styles.contentPanel}>
                  <div className={styles.contentPanelTitle}>{a.type}</div>
                  <div className={styles.contentBody}>
                    {contentByArtefactId[a.id] ?? "Loading…"}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className={styles.footer}>a Swakojo Group company</footer>
    </div>
  );
}
