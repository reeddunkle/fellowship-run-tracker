export const LAYER_GRAPH_SOURCE_FILE = "src/layers/api-layer.ts";

export const LAYER_GRAPH_OUTPUTS = {
  analysis: {
    serviceBundleJson: "docs/architecture/analysis/service-bundles.json",
    serviceBundleMemberships: {
      mermaid: "docs/architecture/analysis/service-bundle-memberships.mmd",
      svg: "docs/architecture/analysis/service-bundle-memberships.svg",
    },
    serviceBundleRelationships: {
      mermaid: "docs/architecture/analysis/service-bundle-relationships.mmd",
      svg: "docs/architecture/analysis/service-bundle-relationships.svg",
    },
    serviceBundleRequirementReductions: {
      mermaid:
        "docs/architecture/analysis/service-bundle-requirement-reductions.mmd",
      svg: "docs/architecture/analysis/service-bundle-requirement-reductions.svg",
    },
  },
  appGraph: "docs/architecture/api-layer.app.mmd",
} as const;

export const LAYER_GRAPH_ANALYSIS_OUTPUT_DIRECTORY =
  "docs/architecture/analysis";
