import { readFileSync } from "node:fs";

import { parse } from "jsonc-parser";
import { defineConfig } from "oxlint";

type BiomeConfig = {
  readonly files?: {
    readonly includes?: readonly string[];
  };
};

const biomeConfig: BiomeConfig = parse(
  readFileSync(new URL("./biome.jsonc", import.meta.url), "utf8"),
);

const biomeIgnorePatterns = (biomeConfig.files?.includes ?? [])
  .filter((pattern) => pattern.startsWith("!"))
  .map((pattern) => pattern.replace(/^!+/, ""));

export default defineConfig({
  categories: {
    correctness: "off",
    nursery: "off",
    pedantic: "off",
    perf: "off",
    restriction: "off",
    style: "off",
    suspicious: "off",
  },
  ignorePatterns: biomeIgnorePatterns,
  jsPlugins: [
    "./tools/dev-scripts/src/comment-policy/comment-policy-plugin.ts",
    "@shadcn/lint",
  ],
  overrides: [
    {
      files: [
        "**/src/tests/**",
        "**/vite*.config.ts",
        "apps/electron/forge.config.js",
        "apps/electron/src/bootstrap.ts",
        "packages/shared/src/fellowship/validation/events/**",
        "packages/ui/src/**",
      ],
      rules: {
        "comment-policy/require-comment-marker": "off",
      },
    },
    {
      files: ["packages/ui/src/primitives/**", "packages/ui/src/styles/**"],
      rules: {
        "shadcn/no-arbitrary-values": "off",
        "shadcn/no-restyle": "off",
        "shadcn/require-static-classes": "off",
      },
    },
  ],
  plugins: ["import"],
  rules: {
    "comment-policy/require-comment-marker": "error",
    "import/extensions": ["error", "always", { ignorePackages: true }],
    "shadcn/no-arbitrary-values": ["warn", { allow: ["layout"] }],
    "shadcn/no-inline-styles": "warn",
    "shadcn/no-raw-colors": "warn",
    "shadcn/no-restyle": ["warn", { allow: ["layout"] }],
    "shadcn/no-unknown-classes": "warn",
    "shadcn/require-static-classes": "warn",
  },
  settings: {
    shadcn: {
      note: 'See "Where a style goes" in packages/ui/README.md before adding a variant, composite, or token.',
      ui: "@frt/ui",
    },
  },
});
