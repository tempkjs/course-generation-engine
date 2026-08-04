"use client";
// DISPOSABLE verification harness. Intentionally minimal and unstyled.
// Imports ONLY the engine's public client — the same seam the real website uses.
import { useState } from "react";
import { CourseEngineClient } from "@/modules/engine";
import type { Course } from "@/contracts";

const client = new CourseEngineClient();

export default function Harness() {
  const [topic, setTopic] = useState("Automation Testing, End to End");
  const [course, setCourse] = useState<Course | null>(null);

  async function run() {
    const c = await client.generateCurriculum({
      topic,
      field: "software",
      level: "medium",
      audienceExperience: "3-5 yrs",
      durationWeeks: 5,
      cadence: "weekend-2x2",
      practitionerId: "p-demo",
      style: {
        practitionerId: "p-demo",
        modalities: ["textual", "slide"],
        tone: "plain",
        depth: "working",
      },
    });
    setCourse(c);
  }

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h2>Seam 1 harness — generateCurriculum</h2>
      <input
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        style={{ width: "100%", padding: 8 }}
      />
      <button onClick={run} style={{ marginTop: 8, padding: "8px 16px" }}>
        Generate
      </button>
      {course && (
        <pre
          style={{
            background: "#f5f5f5",
            padding: 12,
            marginTop: 16,
            overflow: "auto",
          }}
        >
          {JSON.stringify(course, null, 2)}
        </pre>
      )}
    </main>
  );
}
