/** @type {import('next').NextConfig} */
export default {
  reactStrictMode: true,
  // `next dev` disposes an on-demand-compiled API route after it's been idle — recompiling
  // it on the next hit re-evaluates its module graph, which resets the process-level
  // courseStore/contentStore singletons (the Seam-4 mock) those routes share. Harmless for a
  // quick click-through, but a /studio demo can sit on one step for a while mid-explanation;
  // without this, a long pause mid-demo can silently drop the in-progress course. Bumped well
  // past any realistic pause. See src/app/studio/page.tsx's route warm-up for the matching
  // "never let a route be cold on its first hit" half of this fix.
  onDemandEntries: { maxInactiveAge: 1000 * 60 * 60, pagesBufferLength: 10 },
};
