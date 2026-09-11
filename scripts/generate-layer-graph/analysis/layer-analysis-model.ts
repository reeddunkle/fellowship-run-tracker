import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as Option from "effect/Option";

import { parseGraphEdges } from "../mermaid/mermaid-graph-edge.ts";
import {
  getLayerContract,
  type LayerContract,
} from "../mermaid/mermaid-layer-graph.ts";
import { parseTopLevelSubgraphs } from "../mermaid/mermaid-subgraph.ts";

export type LayerAnalysisNode = LayerContract & {
  readonly composedFrom: ReadonlyArray<string>;
  readonly id: string;
};

export type LayerAnalysisModel = {
  readonly layers: ReadonlyArray<LayerAnalysisNode>;
};

function getReferencedLayerId({
  layerIds,
  reference,
}: {
  readonly layerIds: ReadonlyArray<string>;
  readonly reference: string;
}): string | undefined {
  return pipe(
    layerIds,
    A.findFirst((layerId) => {
      return reference === layerId || reference.startsWith(`${layerId}_`);
    }),
    Option.getOrUndefined,
  );
}

export function createLayerAnalysisModel(source: string): LayerAnalysisModel {
  const blocks = parseTopLevelSubgraphs(source);
  const edges = parseGraphEdges(source);

  const layerIds = pipe(
    blocks,
    A.map((block) => block.id),
  );

  const layers = pipe(
    blocks,
    A.map((block) => {
      const providesPrefix = `${block.id}_provides_`;

      const composedFrom = pipe(
        edges,
        A.filter((edge) => edge.source.startsWith(providesPrefix)),
        A.flatMap((edge) => {
          const referencedLayerId = getReferencedLayerId({
            layerIds,
            reference: edge.target,
          });

          if (
            referencedLayerId === undefined ||
            referencedLayerId === block.id
          ) {
            return [];
          }

          return [referencedLayerId];
        }),
        A.dedupe,
      );

      return {
        composedFrom,
        id: block.id,
        ...getLayerContract(block),
      };
    }),
  );

  return {
    layers,
  };
}
