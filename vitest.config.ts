import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Next.js aliases this to a no-op for server builds; vitest is a server-side
      // consumer too, so match that here instead of the package's throwing default.
      "server-only": fileURLToPath(
        new URL("./tests/support/server-only-shim.ts", import.meta.url),
      ),
    },
  },
  test: {
    environment: "node",
    globals: true,
    setupFiles: ["./tests/support/load-env.ts"],
  },
});
