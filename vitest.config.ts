import path from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

const projectRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(projectRoot, "./src"),
    },
  },
  test: {
    exclude: [...configDefaults.exclude, "src/tests/browser/**"],
    fsModuleCache: true,
    root: projectRoot,
    setupFiles: ["./src/tests/setup.ts"],
  },
});
