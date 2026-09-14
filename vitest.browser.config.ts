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
      "@tanstack/react-router",
      "effect/unstable/httpapi/HttpApi",
      "effect/unstable/httpapi/HttpApiClient",
      "effect/unstable/httpapi/HttpApiEndpoint",
      "effect/unstable/httpapi/HttpApiError",
      "effect/unstable/httpapi/HttpApiGroup",
      "effect/unstable/httpapi/HttpApiSchema",
      "effect/unstable/schema/Model",
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
