import * as A from "effect/Array";
import { pipe } from "effect/Function";

import { type SubgraphBlock } from "../validation/subgraph-header-schema.ts";
import {
  escapeRegExp,
  findSubgraphEndIndex,
  getIndexedSubgraphMatches,
  getSubgraphRemovalIndexes,
  parseTopLevelSubgraphs,
  removeLineIndexes,
  removeSubgraphBlocks,
} from "./mermaid-subgraph.ts";

const CONTRACT_SECTION_START_PATTERN =
  /^\s*subgraph (?<id>\S+_(?:requires|provides)) \[(?:Requires|Provides)\]\s*$/;

const WRAPPER_SUBGRAPH_START_PATTERN =
  /^\s*subgraph (?<id>\S+_wrap)\[" "\]\s*$/;

export type LayerContract = {
  readonly name: string;
  readonly provides: ReadonlyArray<string>;
  readonly requires: ReadonlyArray<string>;
};

export function getContractServices({
  block,
  section,
}: {
  readonly block: SubgraphBlock;
  readonly section: "provides" | "requires";
}): ReadonlyArray<string> {
  const escapedId = escapeRegExp(block.id);

  const servicePattern = new RegExp(
    `^\\s*${escapedId}_${section}_\\d+\\["(?<service>.*)"\\]\\s*$`,
  );

  return pipe(
    block.text.split("\n"),
    A.flatMap((line) => {
      const match = servicePattern.exec(line);
      const service = match?.groups?.service;

      return service === undefined ? [] : [service];
    }),
    (services) => services.toSorted(),
  );
}

export function getLayerContract(block: SubgraphBlock): LayerContract {
  return {
    name: block.name,
    provides: getContractServices({
      block,
      section: "provides",
    }),
    requires: getContractServices({
      block,
      section: "requires",
    }),
  };
}

function getLayerContractKey(block: SubgraphBlock): string {
  return JSON.stringify(getLayerContract(block));
}

function getCanonicalNodeIds(
  blocks: ReadonlyArray<SubgraphBlock>,
): ReadonlyMap<string, string> {
  return pipe(
    blocks,
    A.reduce(
      {
        canonicalIdByContract: new Map<string, string>(),
        canonicalIdByNodeId: new Map<string, string>(),
      },
      (state, block) => {
        const contractKey = getLayerContractKey(block);
        const canonicalId = state.canonicalIdByContract.get(contractKey);

        if (canonicalId === undefined) {
          state.canonicalIdByContract.set(contractKey, block.id);
        } else {
          state.canonicalIdByNodeId.set(block.id, canonicalId);
        }

        return state;
      },
    ),
    ({ canonicalIdByNodeId }) => canonicalIdByNodeId,
  );
}

function replaceNodeReference({
  canonicalId,
  line,
  nodeId,
}: {
  readonly canonicalId: string;
  readonly line: string;
  readonly nodeId: string;
}): string {
  const escapedId = escapeRegExp(nodeId);

  const pattern = new RegExp(
    `(?<![A-Za-z0-9_])${escapedId}(?=_[A-Za-z0-9_]+|[^A-Za-z0-9_]|$)`,
    "g",
  );

  return line.replace(pattern, canonicalId);
}

function canonicalizeNodeReferences({
  canonicalNodeIds,
  source,
}: {
  readonly canonicalNodeIds: ReadonlyMap<string, string>;
  readonly source: string;
}): string {
  const canonicalEntries = Array.from(canonicalNodeIds);

  return pipe(
    source.split("\n"),
    A.map((line) => {
      return pipe(
        canonicalEntries,
        A.reduce(line, (updatedLine, [nodeId, canonicalId]) => {
          return replaceNodeReference({
            canonicalId,
            line: updatedLine,
            nodeId,
          });
        }),
      );
    }),
    (lines) => lines.join("\n"),
  );
}

export function collapseDuplicateSubgraphs(source: string): string {
  const blocks = parseTopLevelSubgraphs(source);
  const canonicalNodeIds = getCanonicalNodeIds(blocks);

  if (canonicalNodeIds.size === 0) {
    return source;
  }

  const duplicateNodeIds = new Set(canonicalNodeIds.keys());

  const withoutDuplicateBlocks = removeSubgraphBlocks({
    nodeIds: duplicateNodeIds,
    source,
  });

  return canonicalizeNodeReferences({
    canonicalNodeIds,
    source: withoutDuplicateBlocks,
  });
}

function isServiceEntryForSection({
  line,
  sectionId,
}: {
  readonly line: string;
  readonly sectionId: string;
}): boolean {
  const escapedSectionId = escapeRegExp(sectionId);

  return new RegExp(`^\\s*${escapedSectionId}_\\d+\\[".*"\\]\\s*$`).test(line);
}

export function removeEmptyContractSections(source: string): string {
  const lines = source.split("\n");

  const removedLineIndexes = pipe(
    getIndexedSubgraphMatches({
      lines,
      pattern: CONTRACT_SECTION_START_PATTERN,
    }),
    A.flatMap(({ id, startIndex }) => {
      const endIndex = findSubgraphEndIndex({
        lines,
        startIndex,
      });

      const hasServiceEntries = pipe(
        lines.slice(startIndex + 1, endIndex),
        A.some((line) => {
          return isServiceEntryForSection({
            line,
            sectionId: id,
          });
        }),
      );

      return hasServiceEntries
        ? []
        : getSubgraphRemovalIndexes({
            endIndex,
            id,
            lines,
            startIndex,
          });
    }),
    (lineIndexes) => new Set(lineIndexes),
  );

  return removeLineIndexes({
    lines,
    removedLineIndexes,
  });
}

export function removeEmptyWrapperSubgraphs(source: string): string {
  const lines = source.split("\n");

  const removedLineIndexes = pipe(
    getIndexedSubgraphMatches({
      lines,
      pattern: WRAPPER_SUBGRAPH_START_PATTERN,
    }),
    A.flatMap(({ id, startIndex }) => {
      const endIndex = findSubgraphEndIndex({
        lines,
        startIndex,
      });

      const isEmpty = pipe(
        lines.slice(startIndex + 1, endIndex),
        A.every((line) => line.trim().length === 0),
      );

      return isEmpty
        ? getSubgraphRemovalIndexes({
            endIndex,
            id,
            lines,
            startIndex,
          })
        : [];
    }),
    (lineIndexes) => new Set(lineIndexes),
  );

  return removeLineIndexes({
    lines,
    removedLineIndexes,
  });
}
