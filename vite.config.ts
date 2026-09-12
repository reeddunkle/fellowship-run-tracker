import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

import { parseEnv } from "./src/parse-env.ts";

const projectRoot = path.resolve(import.meta.dirname);

export default defineConfig(({ mode }) => {
  const env = parseEnv(loadEnv(mode, projectRoot, ""));

  return {
    base: "./",

    build: {
      emptyOutDir: false,
      outDir: path.resolve(projectRoot, "dist/electron/renderer"),
    },

    envDir: projectRoot,
    envPrefix: ["VITE_", "PUBLIC_"],

    plugins: [
      tanstackRouter({
        autoCodeSplitting: true,
        generatedRouteTree: "./router/routeTree.gen.ts",
        routesDirectory: "./router/routes",
        target: "react",
      }),
      react(),
      tailwindcss(),
    ],

    resolve: {
      alias: {
        "@": path.resolve(projectRoot, "./src"),
      },
    },

    root: path.resolve(projectRoot, "src/electron/renderer"),

    server: {
      host: env.electronRenderer.host,
      port: env.electronRenderer.port,
      strictPort: true,
    },
  };
});
