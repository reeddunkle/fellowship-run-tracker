import path from "node:path";

import { configDefaults, defineConfig } from "vitest/config";

const projectRoot = path.resolve(import.meta.dirname);
const workspaceRoot = path.resolve(projectRoot, "../..");

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(projectRoot, "./src"),
    },
  },
  test: {
    // Tests don't read the dev `.env`; anything they write goes to the same
    // gitignored `data/` directory as the other dev runs.
    env: {
      APP_DATA_DIRECTORY: path.join(workspaceRoot, "data"),
    },
    exclude: [...configDefaults.exclude],
    fsModuleCache: true,
    root: projectRoot,
  },
});
