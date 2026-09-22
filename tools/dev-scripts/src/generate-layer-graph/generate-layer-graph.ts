import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";

import { fixWithBiome } from "@frt/api/helpers/fix-with-biome.ts";

import { createLayerAnalysisModel } from "./analysis/layer-analysis-model.ts";
import { analyzeServiceBundles } from "./analysis/service-bundle-analysis.ts";
import {
  renderServiceBundleAnalysisJson,
  renderServiceBundleMembershipsMermaid,
  renderServiceBundleRelationshipsMermaid,
  renderServiceBundleRequirementReductionsMermaid,
} from "./analysis/service-bundle-analysis-renderers.ts";
import { EffectTsGoLspLive } from "./effect-tsgo-lsp-service.ts";
import {
  MermaidGraphParseError,
  MermaidSubgraphError,
} from "./errors/mermaid-graph-error.ts";
import { filterLayerGraph } from "./filter-layer-graph.ts";
import { getLayerLspGraph } from "./get-layer-lsp-graph.ts";
import {
  LAYER_GRAPH_ANALYSIS_OUTPUT_DIRECTORY,
  LAYER_GRAPH_OUTPUTS,
  LAYER_GRAPH_SOURCE_FILE,
} from "./layer-graph-config.ts";

const PlatformLive = NodeServices.layer;

/**
 * The Mermaid graph helpers are plain functions that throw on malformed
 * graphs; run them as typed failures instead of defects.
 */
function parseMermaidGraph<A>(parse: () => A) {
  return E.try({
    catch: (cause) => {
      return cause instanceof MermaidSubgraphError
        ? cause
        : new MermaidGraphParseError({ cause });
    },
    try: parse,
  });
}

const EffectTsGoLspWithDependencies = EffectTsGoLspLive.pipe(
  Layer.provide(PlatformLive),
);

const AppLive = Layer.mergeAll(PlatformLive, EffectTsGoLspWithDependencies);

const program = E.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;

  const generatedGraph = yield* getLayerLspGraph({
    sourceFile: LAYER_GRAPH_SOURCE_FILE,
  });

  const appGraph = yield* parseMermaidGraph(() => {
    return filterLayerGraph(generatedGraph.mermaid);
  });

  const analysisModel = yield* parseMermaidGraph(() => {
    return createLayerAnalysisModel(appGraph);
  });

  const serviceBundleAnalysis = pipe(analysisModel, analyzeServiceBundles);

  const serviceBundleJson = pipe(
    serviceBundleAnalysis,
    renderServiceBundleAnalysisJson,
  );

  const serviceBundleMembershipsMermaid = pipe(
    serviceBundleAnalysis,
    renderServiceBundleMembershipsMermaid,
  );

  const serviceBundleRelationshipsMermaid = pipe(
    serviceBundleAnalysis,
    renderServiceBundleRelationshipsMermaid,
  );

  const serviceBundleRequirementReductionsMermaid = pipe(
    serviceBundleAnalysis,
    renderServiceBundleRequirementReductionsMermaid,
  );

  yield* fileSystem.makeDirectory(LAYER_GRAPH_ANALYSIS_OUTPUT_DIRECTORY, {
    recursive: true,
  });

  yield* E.all([
    fileSystem.writeFileString(LAYER_GRAPH_OUTPUTS.appGraph, appGraph),
    fileSystem
      .writeFileString(
        LAYER_GRAPH_OUTPUTS.analysis.serviceBundleJson,
        serviceBundleJson,
      )
      .pipe(
        E.andThen(
          fixWithBiome([LAYER_GRAPH_OUTPUTS.analysis.serviceBundleJson]),
        ),
      ),
    fileSystem.writeFileString(
      LAYER_GRAPH_OUTPUTS.analysis.serviceBundleMemberships.mermaid,
      serviceBundleMembershipsMermaid,
    ),
    fileSystem.writeFileString(
      LAYER_GRAPH_OUTPUTS.analysis.serviceBundleRelationships.mermaid,
      serviceBundleRelationshipsMermaid,
    ),
    fileSystem.writeFileString(
      LAYER_GRAPH_OUTPUTS.analysis.serviceBundleRequirementReductions.mermaid,
      serviceBundleRequirementReductionsMermaid,
    ),
  ]);

  yield* E.logInfo("Layer graph generated.", {
    outputFile: LAYER_GRAPH_OUTPUTS.appGraph,
    sourceFile: LAYER_GRAPH_SOURCE_FILE,
    symbol: generatedGraph.symbolName,
  });

  yield* E.logInfo("Layer graph analyses generated.", {
    serviceBundleJsonFile: LAYER_GRAPH_OUTPUTS.analysis.serviceBundleJson,
    serviceBundleMembershipsMermaidFile:
      LAYER_GRAPH_OUTPUTS.analysis.serviceBundleMemberships.mermaid,
    serviceBundleRelationshipsMermaidFile:
      LAYER_GRAPH_OUTPUTS.analysis.serviceBundleRelationships.mermaid,
    serviceBundleRequirementReductionsMermaidFile:
      LAYER_GRAPH_OUTPUTS.analysis.serviceBundleRequirementReductions.mermaid,
  });
});

program.pipe(E.provide(AppLive), NodeRuntime.runMain);
