import * as A from "effect/Array";
import { pipe } from "effect/Function";

import {
  hasNodeReference,
  removeDuplicateGraphLines,
  removeNodes,
  removeTopLevelNodesWithSplicedEdges,
} from "./mermaid/mermaid-graph-edge.ts";
import {
  collapseDuplicateSubgraphs,
  removeEmptyContractSections,
  removeEmptyWrapperSubgraphs,
} from "./mermaid/mermaid-layer-graph.ts";
import {
  getEmptyTopLevelNodeIds,
  parseTopLevelSubgraphs,
  stripSubgraphMetadata,
} from "./mermaid/mermaid-subgraph.ts";

const EXCLUDED_LAYER_NAMES = new Set([
  "NodeApiHttpServerLive",
  "NodePlatformLive",
  "NodeFileSystemLive",
  "NodePathLive",
]);

const EXCLUDED_SERVICE_NAMES = new Set([
  "ChildProcessSpawner",
  "Crypto",
  "FileSystem",
  "Generator",
  "HttpPlatform",
  "HttpRouter",
  "HttpServer",
  "Path",
  "Stdio",
  "Terminal",
]);

const ENCODED_ERROR_REQUEST_PREFIX = "Request#lt;#quot;Error#quot;,";
const ENCODED_REQUIRED_REQUEST_PREFIX = "Request#lt;#quot;Requires#quot;,";
const ENCODED_APP_SERVICE_PREFIX = "Service#lt;#quot;app#quot;,";

const ERROR_REQUEST_PREFIX = 'Request<"Error",';
const REQUIRED_REQUEST_PREFIX = 'Request<"Requires",';
const APP_SERVICE_PREFIX = 'Service<"app",';

const LAYER_PROVIDE_PREFIX = "Layer.provide(";
const LAYER_MERGE_ALL_PREFIX = "Layer.mergeAll(";

const SERVICE_LINE_PATTERN =
  /^(?<indent>\s*)(?<id>\S+_(?:provides|requires)_\d+)\["(?<service>.*)"\]\s*$/;

function getTopLevelNodeIdsByName({
  matches,
  source,
}: {
  readonly matches: (name: string) => boolean;
  readonly source: string;
}): ReadonlySet<string> {
  return pipe(
    source,
    parseTopLevelSubgraphs,
    A.filter(({ name }) => matches(name)),
    A.map(({ id }) => id),
    (nodeIds) => new Set(nodeIds),
  );
}

function getExcludedLayerNodeIds(source: string): ReadonlySet<string> {
  return getTopLevelNodeIdsByName({
    matches: (name) => EXCLUDED_LAYER_NAMES.has(name),
    source,
  });
}

function getLayerProvideNodeIds(source: string): ReadonlySet<string> {
  return getTopLevelNodeIdsByName({
    matches: (name) => name.startsWith(LAYER_PROVIDE_PREFIX),
    source,
  });
}

function getLayerMergeAllNodeIds(source: string): ReadonlySet<string> {
  return getTopLevelNodeIdsByName({
    matches: (name) => name.startsWith(LAYER_MERGE_ALL_PREFIX),
    source,
  });
}

function removeTrailingEncodedClosingType(value: string): string {
  return value.endsWith("#gt;") ? value.slice(0, -"#gt;".length) : value;
}

function removeTrailingClosingType(value: string): string {
  return value.endsWith(">") ? value.slice(0, -1) : value;
}

function normalizeServiceName(service: string): string | undefined {
  if (EXCLUDED_SERVICE_NAMES.has(service)) {
    return undefined;
  }

  if (
    service.startsWith(ENCODED_ERROR_REQUEST_PREFIX) ||
    service.startsWith(ERROR_REQUEST_PREFIX)
  ) {
    return undefined;
  }

  if (
    service.startsWith(ENCODED_APP_SERVICE_PREFIX) ||
    service.startsWith(APP_SERVICE_PREFIX)
  ) {
    return undefined;
  }

  if (service.startsWith(ENCODED_REQUIRED_REQUEST_PREFIX)) {
    return pipe(
      service,
      (value) => value.slice(ENCODED_REQUIRED_REQUEST_PREFIX.length),
      (value) => value.trim(),
      removeTrailingEncodedClosingType,
    );
  }

  if (service.startsWith(REQUIRED_REQUEST_PREFIX)) {
    return pipe(
      service,
      (value) => value.slice(REQUIRED_REQUEST_PREFIX.length),
      (value) => value.trim(),
      removeTrailingClosingType,
    );
  }

  return service;
}

function normalizeServiceEntries(source: string): string {
  const removedServiceNodeIds = new Set<string>();

  const normalized = pipe(
    source.split("\n"),
    A.flatMap((line) => {
      const match = SERVICE_LINE_PATTERN.exec(line);

      if (match?.groups === undefined) {
        return [line];
      }

      const { id, indent, service } = match.groups;

      if (id === undefined || indent === undefined || service === undefined) {
        return [line];
      }

      const normalizedService = normalizeServiceName(service);

      if (normalizedService === undefined) {
        removedServiceNodeIds.add(id);
        return [];
      }

      if (normalizedService === service) {
        return [line];
      }

      return [`${indent}${id}["${normalizedService}"]`];
    }),
    (lines) => lines.join("\n"),
  );

  if (removedServiceNodeIds.size === 0) {
    return normalized;
  }

  return pipe(
    normalized.split("\n"),
    A.filter((line) => {
      return !hasNodeReference(line, removedServiceNodeIds);
    }),
    (lines) => lines.join("\n"),
  );
}

export function filterLayerGraph(source: string): string {
  const excludedNodeIds = getExcludedLayerNodeIds(source);

  const withoutExcludedNodes = removeNodes({
    nodeIds: excludedNodeIds,
    source,
  });

  const withNormalizedServices = normalizeServiceEntries(withoutExcludedNodes);

  const withoutEmptyContractSections = pipe(
    withNormalizedServices,
    removeEmptyContractSections,
  );

  const withoutEmptyWrappers = pipe(
    withoutEmptyContractSections,
    removeEmptyWrapperSubgraphs,
  );

  const emptyTopLevelNodeIds = getEmptyTopLevelNodeIds(withoutEmptyWrappers);

  const withoutEmptyTopLevelNodes = removeTopLevelNodesWithSplicedEdges({
    nodeIds: emptyTopLevelNodeIds,
    source: withoutEmptyWrappers,
  });

  const layerProvideNodeIds = getLayerProvideNodeIds(withoutEmptyTopLevelNodes);

  const withoutLayerProvideNodes = removeTopLevelNodesWithSplicedEdges({
    nodeIds: layerProvideNodeIds,
    source: withoutEmptyTopLevelNodes,
  });

  const layerMergeAllNodeIds = getLayerMergeAllNodeIds(
    withoutLayerProvideNodes,
  );

  const withoutLayerMergeAllNodes = removeTopLevelNodesWithSplicedEdges({
    nodeIds: layerMergeAllNodeIds,
    source: withoutLayerProvideNodes,
  });

  const collapsed = pipe(withoutLayerMergeAllNodes, collapseDuplicateSubgraphs);

  const withoutMetadata = stripSubgraphMetadata({
    blocks: parseTopLevelSubgraphs(collapsed),
    source: collapsed,
  });

  const cleaned = pipe(withoutMetadata, removeDuplicateGraphLines);

  return `${cleaned.trimEnd()}\n`;
}
