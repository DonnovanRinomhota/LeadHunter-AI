import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const path = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      "@": path("./src"),
      "server-only": path("./evals/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    // npm run eval:live is the only run that uses the live folder, because it costs money.
    include: mode === "live" ? ["evals/**/*.test.ts"] : ["src/**/*.test.ts"],
    testTimeout: mode === "live" ? 600_000 : 5_000,
  },
}));
