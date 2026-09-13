import path from "node:path";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const projectRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  optimizeDeps: {
    include: [
      "effect",
      "effect/Context",
      "effect/DateTime",
      "effect/Deferred",
      "effect/Result",
    ],
  },
  resolve: {
    alias: {
      "@": path.resolve(projectRoot, "./src"),
    },
  },
  test: {
    browser: {
      enabled: true,
      headless: true,
      instances: [
        {
          browser: "chromium",
        },
      ],
      provider: playwright(),
    },
    include: ["src/tests/browser/**/*.test.tsx"],
    root: projectRoot,
  },
});
