import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const projectRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  optimizeDeps: {
    include: [
      "@tanstack/react-query",
      "@tanstack/react-router",
      "date-fns",
      "effect",
      "effect/Context",
      "effect/DateTime",
      "effect/Deferred",
      "effect/Result",
      "effect/http-api/HttpApi",
      "effect/http-api/HttpApiClient",
      "effect/http-api/HttpApiEndpoint",
      "effect/http-api/HttpApiError",
      "effect/http-api/HttpApiGroup",
      "effect/http-api/HttpApiSchema",
      "effect/schema/Model",
    ],
  },
  plugins: [tailwindcss()],
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
    // Run under Node by `vitest.config.ts`.
    exclude: ["src/tests/browser/integration/**"],
    fsModuleCache: true,
    include: ["src/tests/browser/**/*.test.{ts,tsx}"],
    root: projectRoot,
    setupFiles: ["./src/tests/browser/setup.ts"],
  },
});
