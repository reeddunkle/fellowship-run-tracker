import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as E from "effect/Effect";
import { ChildProcessSpawner } from "effect/unstable/process";

import { makePnpmCommand } from "@frt/api/helpers/make-pnpm-command.ts";

import { LayerGraphRenderError } from "./errors/render-layer-graph-error.ts";
import { LAYER_GRAPH_OUTPUTS } from "./layer-graph-config.ts";

const renderTargets = [
  {
    input: LAYER_GRAPH_OUTPUTS.analysis.serviceBundleMemberships.mermaid,
    output: LAYER_GRAPH_OUTPUTS.analysis.serviceBundleMemberships.svg,
  },
  {
    input: LAYER_GRAPH_OUTPUTS.analysis.serviceBundleRelationships.mermaid,
    output: LAYER_GRAPH_OUTPUTS.analysis.serviceBundleRelationships.svg,
  },
  {
    input:
      LAYER_GRAPH_OUTPUTS.analysis.serviceBundleRequirementReductions.mermaid,
    output: LAYER_GRAPH_OUTPUTS.analysis.serviceBundleRequirementReductions.svg,
  },
] as const;

function renderMermaid({
  input,
  output,
}: (typeof renderTargets)[number]): E.Effect<
  void,
  LayerGraphRenderError,
  ChildProcessSpawner.ChildProcessSpawner
> {
  return E.gen(function* () {
    const childProcessSpawner = yield* ChildProcessSpawner.ChildProcessSpawner;

    const command = yield* makePnpmCommand([
      "exec",
      "mmdc",
      "-i",
      input,
      "-o",
      output,
    ]);

    yield* childProcessSpawner.string(command).pipe(
      E.mapError((cause) => {
        return new LayerGraphRenderError({
          cause,
          input,
          output,
        });
      }),
    );
  });
}

const program = E.gen(function* () {
  yield* E.forEach(renderTargets, renderMermaid, {
    concurrency: 1,
  });

  yield* E.logInfo("Layer graph Mermaid files rendered.", {
    files: renderTargets.map((target) => {
      return target.output;
    }),
  });
});

program.pipe(E.provide(NodeServices.layer), NodeRuntime.runMain);
