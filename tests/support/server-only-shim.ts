// Vitest runs as a server-side (Node) consumer, same as the real Next.js server build.
// Next.js's own webpack config aliases 'server-only' to a no-op there and only makes it
// throw in the CLIENT bundle; outside Next's build pipeline the package always throws, so
// vitest.config.ts aliases it to this no-op to match Next's server-side behavior.
export {};
