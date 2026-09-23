import path from "node:path";

import { defineConfig } from "vitest/config";

const projectRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(projectRoot, "./src"),
    },
  },
  test: {
    fsModuleCache: true,
    include: [
      "src/tests/unit-tests/**/*.test.ts",
      // Renderer API clients against a real test API server, which needs Node.
      "src/tests/browser/integration/**/*.test.ts",
    ],
    root: projectRoot,
  },
});
