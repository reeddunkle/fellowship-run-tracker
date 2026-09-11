import path from "node:path";
import { defineConfig } from "vite";

const projectRoot = path.resolve(import.meta.dirname);

export default defineConfig({
  build: {
    emptyOutDir: false,
    outDir: "dist/electron",
    rollupOptions: {
      input: path.resolve(projectRoot, "src/electron/main.ts"),
      output: {
        entryFileNames: "main.js",
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
