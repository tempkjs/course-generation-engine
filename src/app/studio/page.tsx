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
  Level,
  StyleProfile,
} from "@/contracts";
import { CurriculumTree } from "./CurriculumTree";
import { VerificationChecklist } from "./VerificationChecklist";
import { TONE_TEXT } from "./theme";
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
  topic: string;
  field: string;
  jurisdiction: string;
  level: Level;
  durationWeeks: number;
  tone: "plain" | "rigorous";
  depth: StyleProfile["depth"];
  modalities: ArtefactType[];
}

const INITIAL_FORM: FormState = {
  topic: "Employee Relations",
  field: "hr",
  jurisdiction: "IN", // ADR 0018 — the studio demo's default audience is Indian practitioners
  level: "medium",
  durationWeeks: 5,
  tone: "plain",
  depth: "working",
  modalities: ["textual", "slide"],
};

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
        topic: form.topic,
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
    const c = await run("Regenerating…", () =>
      client.refineCurriculum(course.id, [
        {
          op: "regenerate",
          nodeId,
          instruction: instructionDraft.trim() || undefined,
        },
      ]),
    );
    if (c) {
      setCourse(c);
      setRegeneratingNodeId(null);
      setInstructionDraft("");
    }
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
    const generated = await run(
      "Generating material… (this can take up to a minute)",
      () =>
        client.generateArtefacts(course.id, ARTEFACT_PREFS, styleProfile, {
          lessonIds: [selectedLessonId],
        }),
    );
    if (!generated) return;
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
              <label htmlFor="topic">Topic</label>
              <input
                id="topic"
                type="text"
                value={form.topic}
                onChange={(e) => setForm({ ...form, topic: e.target.value })}
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="field">Field</label>
              <input
                id="field"
                type="text"
                value={form.field}
                onChange={(e) => setForm({ ...form, field: e.target.value })}
              />
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
            disabled={busy !== null || !form.topic.trim()}
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
              onInstructionDraftChange={setInstructionDraft}
              onStartRegenerate={startRegenerate}
              onCancelRegenerate={cancelRegenerate}
              onConfirmRegenerate={confirmRegenerate}
              onRemove={handleRemove}
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
                  disabled={busy !== null || !selectedLessonId}
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
