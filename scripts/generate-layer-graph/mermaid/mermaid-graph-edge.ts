import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as Option from "effect/Option";

import { escapeRegExp, removeSubgraphBlocks } from "./mermaid-subgraph.ts";

const EDGE_PATTERN =
  /^(?<indent>\s*)(?<source>\S+)\s+(?<operator>-\.->|-\.-x)\s+(?<target>\S+)\s*$/;

const STYLE_PATTERN = /^\s*style\s+\S+\s+/;

type GraphEdgeOperator = "-.->" | "-.-x";

export type GraphEdge = {
  readonly indent: string;
  readonly operator: GraphEdgeOperator;
  readonly source: string;
  readonly target: string;
};

type IndexedGraphEdge = {
  readonly edge: GraphEdge;
  readonly index: number;
};

export function hasNodeReference(
  line: string,
  nodeIds: ReadonlySet<string>,
): boolean {
  return pipe(
    Array.from(nodeIds),
    A.some((id) => {
      const escapedId = escapeRegExp(id);

      const pattern = new RegExp(
        `(?<![A-Za-z0-9_])${escapedId}(?:_[A-Za-z0-9_]+)*(?![A-Za-z0-9_])`,
      );

      return pattern.test(line);
    }),
  );
}

function parseGraphEdge(line: string): GraphEdge | undefined {
  const match = EDGE_PATTERN.exec(line);
  const { indent, operator, source, target } = match?.groups ?? {};

  if (
    indent === undefined ||
    source === undefined ||
    target === undefined ||
    (operator !== "-.->" && operator !== "-.-x")
  ) {
    return undefined;
  }

  return {
    indent,
    operator,
    source,
    target,
  };
}

export function parseGraphEdges(source: string): ReadonlyArray<GraphEdge> {
  return pipe(
    source.split("\n"),
    A.flatMap((line) => {
      const edge = parseGraphEdge(line);

      return edge === undefined ? [] : [edge];
    }),
  );
}

function isNodeReference({
  nodeId,
  reference,
}: {
  readonly nodeId: string;
  readonly reference: string;
}): boolean {
  return reference === nodeId || reference.startsWith(`${nodeId}_`);
}

function doesEdgeReferenceNodeIds({
  edge,
  nodeIds,
}: {
  readonly edge: GraphEdge;
  readonly nodeIds: ReadonlySet<string>;
}): boolean {
  return pipe(
    Array.from(nodeIds),
    A.some((nodeId) => {
      return (
        isNodeReference({
          nodeId,
          reference: edge.source,
        }) ||
        isNodeReference({
          nodeId,
          reference: edge.target,
        })
      );
    }),
  );
}

export function removeNodes({
  nodeIds,
  source,
}: {
  readonly nodeIds: ReadonlySet<string>;
  readonly source: string;
}): string {
  const withoutBlocks = removeSubgraphBlocks({
    nodeIds,
    source,
  });

  return pipe(
    withoutBlocks.split("\n"),
    A.filter((line) => {
      const edge = parseGraphEdge(line);

      return (
        edge === undefined ||
        !doesEdgeReferenceNodeIds({
          edge,
          nodeIds,
        })
      );
    }),
    (lines) => lines.join("\n"),
  );
}

function isSelfEdge(line: string): boolean {
  const edge = parseGraphEdge(line);

  return edge !== undefined && edge.source === edge.target;
}

export function removeDuplicateGraphLines(source: string): string {
  return pipe(
    source.split("\n"),
    A.reduce(
      {
        lines: [] as Array<string>,
        seen: new Set<string>(),
      },
      (state, line) => {
        if (isSelfEdge(line)) {
          return state;
        }

        const isDeduplicatable =
          EDGE_PATTERN.test(line) || STYLE_PATTERN.test(line);

        if (!isDeduplicatable) {
          state.lines.push(line);
          return state;
        }

        if (state.seen.has(line)) {
          return state;
        }

        state.seen.add(line);
        state.lines.push(line);

        return state;
      },
    ),
    ({ lines }) => lines.join("\n"),
  );
}

function getIndexedGraphEdges(
  lines: ReadonlyArray<string>,
): ReadonlyArray<IndexedGraphEdge> {
  return pipe(
    lines,
    A.map((line, index) => {
      return {
        edge: parseGraphEdge(line),
        index,
      };
    }),
    A.filter(
      (
        candidate,
      ): candidate is {
        readonly edge: GraphEdge;
        readonly index: number;
      } => {
        return candidate.edge !== undefined;
      },
    ),
  );
}

function getEdgeKey(edge: GraphEdge): string {
  return `${edge.source} ${edge.operator} ${edge.target}`;
}

function deduplicateEdges(
  edges: ReadonlyArray<GraphEdge>,
): ReadonlyArray<GraphEdge> {
  return pipe(
    edges,
    A.reduce(new Map<string, GraphEdge>(), (edgesByKey, edge) => {
      const edgeKey = getEdgeKey(edge);

      if (!edgesByKey.has(edgeKey)) {
        edgesByKey.set(edgeKey, edge);
      }

      return edgesByKey;
    }),
    (edgesByKey) => Array.from(edgesByKey.values()),
  );
}

function combineEdgeOperators({
  incoming,
  outgoing,
}: {
  readonly incoming: GraphEdgeOperator;
  readonly outgoing: GraphEdgeOperator;
}): GraphEdgeOperator {
  return incoming === "-.-x" || outgoing === "-.-x" ? "-.-x" : "-.->";
}

function getNodeEdgeReferences({
  edges,
  nodeId,
}: {
  readonly edges: ReadonlyArray<GraphEdge>;
  readonly nodeId: string;
}): ReadonlyArray<string> {
  return pipe(
    edges,
    A.flatMap(({ source, target }) => [source, target]),
    A.filter((reference) => {
      return isNodeReference({
        nodeId,
        reference,
      });
    }),
    (references) => Array.from(new Set(references)),
  );
}

function getSplicedEdgesForReference({
  edges,
  nodeId,
  reference,
}: {
  readonly edges: ReadonlyArray<GraphEdge>;
  readonly nodeId: string;
  readonly reference: string;
}): ReadonlyArray<GraphEdge> {
  const incomingEdges = pipe(
    edges,
    A.filter(({ source, target }) => {
      return (
        target === reference &&
        !isNodeReference({
          nodeId,
          reference: source,
        })
      );
    }),
  );

  const outgoingEdges = pipe(
    edges,
    A.filter(({ source, target }) => {
      return (
        source === reference &&
        !isNodeReference({
          nodeId,
          reference: target,
        })
      );
    }),
  );

  return pipe(
    incomingEdges,
    A.flatMap((incomingEdge) => {
      return pipe(
        outgoingEdges,
        A.map((outgoingEdge) => {
          return {
            indent: incomingEdge.indent,
            operator: combineEdgeOperators({
              incoming: incomingEdge.operator,
              outgoing: outgoingEdge.operator,
            }),
            source: incomingEdge.source,
            target: outgoingEdge.target,
          };
        }),
      );
    }),
  );
}

function spliceGraphEdgesForNode({
  edges,
  nodeId,
}: {
  readonly edges: ReadonlyArray<GraphEdge>;
  readonly nodeId: string;
}): ReadonlyArray<GraphEdge> {
  const nodeReferences = getNodeEdgeReferences({
    edges,
    nodeId,
  });

  const splicedEdges = pipe(
    nodeReferences,
    A.flatMap((reference) => {
      return getSplicedEdgesForReference({
        edges,
        nodeId,
        reference,
      });
    }),
  );

  const retainedEdges = pipe(
    edges,
    A.filter(({ source, target }) => {
      return (
        !isNodeReference({
          nodeId,
          reference: source,
        }) &&
        !isNodeReference({
          nodeId,
          reference: target,
        })
      );
    }),
  );

  return deduplicateEdges([...retainedEdges, ...splicedEdges]);
}

function spliceGraphEdgesForNodes({
  edges,
  nodeIds,
}: {
  readonly edges: ReadonlyArray<GraphEdge>;
  readonly nodeIds: ReadonlySet<string>;
}): ReadonlyArray<GraphEdge> {
  return pipe(
    Array.from(nodeIds),
    A.reduce(edges, (updatedEdges, nodeId) => {
      return spliceGraphEdgesForNode({
        edges: updatedEdges,
        nodeId,
      });
    }),
  );
}

function renderGraphEdge({
  indent,
  operator,
  source,
  target,
}: GraphEdge): string {
  return `${indent}${source} ${operator} ${target}`;
}

export function removeTopLevelNodesWithSplicedEdges({
  nodeIds,
  source,
}: {
  readonly nodeIds: ReadonlySet<string>;
  readonly source: string;
}): string {
  if (nodeIds.size === 0) {
    return source;
  }

  const withoutBlocks = removeSubgraphBlocks({
    nodeIds,
    source,
  });

  const lines = withoutBlocks.split("\n");
  const indexedEdges = getIndexedGraphEdges(lines);

  const edgeIndexes = pipe(
    indexedEdges,
    A.map(({ index }) => index),
    (indexes) => new Set(indexes),
  );

  const firstEdgeLineIndex = pipe(
    indexedEdges,
    A.head,
    Option.map(({ index }) => index),
    Option.getOrUndefined,
  );

  const splicedEdges = pipe(
    spliceGraphEdgesForNodes({
      edges: pipe(
        indexedEdges,
        A.map(({ edge }) => edge),
      ),
      nodeIds,
    }),
    A.map(renderGraphEdge),
  );

  return pipe(
    lines,
    A.flatMap((line, index) => {
      if (edgeIndexes.has(index)) {
        return index === firstEdgeLineIndex ? splicedEdges : [];
      }

      return [line];
    }),
    (updatedLines) => updatedLines.join("\n"),
  );
}
