import path from "node:path";

import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv, type Plugin } from "vite";

import { APP_CONFIG_DEFAULTS } from "@frt/shared/app-config/app-config-defaults.ts";

import { parseRendererEnv } from "./parse-renderer-env.ts";

const projectRoot = path.resolve(import.meta.dirname);
const workspaceRoot = path.resolve(projectRoot, "../..");

function makeContentSecurityPolicy({
  apiHost,
  apiPort,
}: {
  readonly apiHost: string;
  readonly apiPort: string;
}) {
  return [
    "default-src 'self'",
    "script-src 'self'",
    // UI components set inline `style` attributes.
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data:",
    "font-src 'self' data:",
    `connect-src http://${apiHost}:${apiPort} ws://${apiHost}:${apiPort}`,
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");
}

/**
 * Only applied to production builds: the dev server relies on inline scripts
 * (e.g. React Refresh) and its own WebSocket, which this policy would block.
 */
function contentSecurityPolicyPlugin(policy: string): Plugin {
  return {
    apply: "build",
    name: "content-security-policy",
    transformIndexHtml: () => {
      return [
        {
          attrs: {
            content: policy,
            "http-equiv": "Content-Security-Policy",
          },
          injectTo: "head-prepend",
          tag: "meta",
        },
      ];
    },
  };
}

export default defineConfig(({ mode }) => {
  const workspaceEnv = loadEnv(mode, workspaceRoot, "");
  const env = parseRendererEnv(workspaceEnv);

  const apiHost =
    workspaceEnv.PUBLIC_API_HOST ?? APP_CONFIG_DEFAULTS.PUBLIC_API_HOST;
  const apiPort =
    workspaceEnv.PUBLIC_API_PORT ?? String(APP_CONFIG_DEFAULTS.PUBLIC_API_PORT);

  return {
    base: "./",

    build: {
      emptyOutDir: false,
      outDir: path.resolve(projectRoot, "dist/renderer"),
    },

    // Fall back to the defaults the main process uses when `.env` doesn't set
    // these (e.g. building on a machine without one).
    define: {
      "import.meta.env.PUBLIC_API_HOST": JSON.stringify(apiHost),
      "import.meta.env.PUBLIC_API_PORT": JSON.stringify(apiPort),
      "import.meta.env.PUBLIC_SIMULATE_FELLOWSHIP_LOGS_IMPORTS": JSON.stringify(
        workspaceEnv.FELLOWSHIP_LOGS_SIMULATE_IMPORTS === "true",
      ),
    },

    envDir: workspaceRoot,
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
      contentSecurityPolicyPlugin(
        makeContentSecurityPolicy({
          apiHost,
          apiPort,
        }),
      ),
    ],

    resolve: {
      alias: {
        "@": path.resolve(projectRoot, "./src"),
      },
    },

    root: path.resolve(projectRoot, "src/renderer"),

    server: {
      host: env.host,
      port: env.port,
      strictPort: true,
    },
  };
});
