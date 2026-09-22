import path from "node:path";

import { defineConfig } from "vite";

const projectRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  build: {
    emptyOutDir: false,
    outDir: "dist",
    rollupOptions: {
      input: path.resolve(projectRoot, "src/bootstrap.ts"),
      output: {
        // `bootstrap.js` dynamically imports `main.ts`, emitted as `main.js`.
        // Keep chunks unhashed alongside it, since `main.js` resolves
        // `preload.cjs` and `renderer/` relative to its own location.
        chunkFileNames: "[name].js",
        entryFileNames: "bootstrap.js",
        format: "es",
      },
    },
    ssr: true,
    target: "node22",
  },
  resolve: {
    alias: {
      "@": path.resolve(projectRoot, "src"),
    },
  },
  ssr: {
    external: ["electron"],
  },
});
