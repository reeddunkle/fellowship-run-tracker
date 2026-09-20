import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

const projectRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  optimizeDeps: {
    include: [
      "@base-ui/react/merge-props",
      "@base-ui/react/use-render",
      "@tanstack/react-query",
      "@tanstack/react-router",
      "date-fns",
      "effect",
      "effect/Context",
      "effect/DateTime",
      "effect/Deferred",
      "effect/Result",
      "effect/unstable/httpapi/HttpApi",
      "effect/unstable/httpapi/HttpApiClient",
      "effect/unstable/httpapi/HttpApiEndpoint",
      "effect/unstable/httpapi/HttpApiError",
      "effect/unstable/httpapi/HttpApiGroup",
      "effect/unstable/httpapi/HttpApiSchema",
      "effect/unstable/schema/Model",
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
    include: ["src/tests/browser/**/*.test.tsx"],
    root: projectRoot,
    setupFiles: ["./src/tests/browser/setup.ts"],
  },
});
