import path from "node:path";

import { defineConfig } from "vitest/config";

const projectRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  test: {
    fsModuleCache: true,
    root: projectRoot,
  },
});
