import * as A from "effect/Array";
import { pipe } from "effect/Function";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { MermaidSubgraphError } from "../errors/mermaid-graph-error.ts";
import {
  type SubgraphBlock,
  SubgraphBlockSchema,
  SubgraphEndLineSchema,
  type SubgraphHeader,
  SubgraphHeaderSchema,
  SubgraphStartLineSchema,
} from "../validation/subgraph-header-schema.ts";

const decodeSubgraphHeader = Schema.decodeUnknownResult(SubgraphHeaderSchema);
const decodeSubgraphBlock = Schema.decodeUnknownSync(SubgraphBlockSchema);

const isSubgraphStartLine = Schema.is(SubgraphStartLineSchema);
const isSubgraphEndLine = Schema.is(SubgraphEndLineSchema);

export type IndexedSubgraphBlock = {
  readonly block: SubgraphBlock;
  readonly endIndex: number;
  readonly startIndex: number;
};

type IndexedSubgraphCandidate = {
  readonly id: string | undefined;
  readonly startIndex: number;
};

export type IndexedSubgraphMatch = {
  readonly id: string;
  readonly startIndex: number;
};

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getSubgraphDepthDelta(line: string): number {
  if (isSubgraphStartLine(line)) {
    return 1;
  }

  if (isSubgraphEndLine(line)) {
    return -1;
  }

  return 0;
}

export function findSubgraphEndIndex({
  lines,
  startIndex,
}: {
  readonly lines: ReadonlyArray<string>;
  readonly startIndex: number;
}): number {
  const result = pipe(
    lines.slice(startIndex),
    A.reduce(
      {
        depth: 0,
        endIndex: undefined as number | undefined,
      },
      (state, line, offset) => {
        if (state.endIndex !== undefined) {
          return state;
        }

        state.depth += getSubgraphDepthDelta(line);

        if (offset > 0 && state.depth === 0) {
          state.endIndex = startIndex + offset;
        }

        return state;
      },
    ),
  );

  if (result.endIndex === undefined) {
    throw new MermaidSubgraphError({
      message: `Could not find the end of Mermaid subgraph starting at line ${
        startIndex + 1
      }.`,
      startIndex,
    });
  }

  return result.endIndex;
}

function parseSubgraphBlock({
  header,
  lines,
  startIndex,
}: {
  readonly header: SubgraphHeader;
  readonly lines: ReadonlyArray<string>;
  readonly startIndex: number;
}): {
  readonly block: SubgraphBlock;
  readonly endIndex: number;
} {
  const endIndex = findSubgraphEndIndex({
    lines,
    startIndex,
  });

  return {
    block: decodeSubgraphBlock({
      ...header,
      text: lines.slice(startIndex, endIndex + 1).join("\n"),
    }),
    endIndex,
  };
}

export function parseIndexedTopLevelSubgraphs(
  source: string,
): ReadonlyArray<IndexedSubgraphBlock> {
  const lines = source.split("\n");

  return pipe(
    lines,
    A.reduce(
      {
        blocks: [] as Array<IndexedSubgraphBlock>,
        skipThroughIndex: -1,
      },
      (state, line, startIndex) => {
        if (startIndex <= state.skipThroughIndex) {
          return state;
        }

        const headerResult = decodeSubgraphHeader(line);

        if (Result.isFailure(headerResult)) {
          return state;
        }

        const { block, endIndex } = parseSubgraphBlock({
          header: headerResult.success,
          lines,
          startIndex,
        });

        state.blocks.push({
          block,
          endIndex,
          startIndex,
        });

        state.skipThroughIndex = endIndex;

        return state;
      },
    ),
    ({ blocks }) => blocks,
  );
}

export function parseTopLevelSubgraphs(
  source: string,
): ReadonlyArray<SubgraphBlock> {
  return pipe(
    source,
    parseIndexedTopLevelSubgraphs,
    A.map(({ block }) => block),
  );
}

function isIndexedSubgraphMatch(
  candidate: IndexedSubgraphCandidate,
): candidate is IndexedSubgraphMatch {
  return candidate.id !== undefined;
}

export function getIndexedSubgraphMatches({
  lines,
  pattern,
}: {
  readonly lines: ReadonlyArray<string>;
  readonly pattern: RegExp;
}): ReadonlyArray<IndexedSubgraphMatch> {
  return pipe(
    lines,
    A.map((line, startIndex): IndexedSubgraphCandidate => {
      const match = pattern.exec(line);

      return {
        id: match?.groups?.id,
        startIndex,
      };
    }),
    A.filter(isIndexedSubgraphMatch),
  );
}

function getRange({
  end,
  start,
}: {
  readonly end: number;
  readonly start: number;
}): ReadonlyArray<number> {
  if (end < start) {
    return [];
  }

  return Array.from({ length: end - start + 1 }, (_, offset) => start + offset);
}

function getFollowingStyleLineIndexes({
  id,
  lines,
  startIndex,
}: {
  readonly id: string;
  readonly lines: ReadonlyArray<string>;
  readonly startIndex: number;
}): ReadonlyArray<number> {
  const followingLines = lines.slice(startIndex);

  const firstNonStyleOffset = followingLines.findIndex((line) => {
    return !line.trimStart().startsWith(`style ${id} `);
  });

  const styleLineCount =
    firstNonStyleOffset === -1 ? followingLines.length : firstNonStyleOffset;

  return getRange({
    end: startIndex + styleLineCount - 1,
    start: startIndex,
  });
}

export function getSubgraphRemovalIndexes({
  endIndex,
  id,
  lines,
  startIndex,
}: {
  readonly endIndex: number;
  readonly id: string;
  readonly lines: ReadonlyArray<string>;
  readonly startIndex: number;
}): ReadonlyArray<number> {
  return [
    ...getRange({
      end: endIndex,
      start: startIndex,
    }),
    ...getFollowingStyleLineIndexes({
      id,
      lines,
      startIndex: endIndex + 1,
    }),
  ];
}

export function removeLineIndexes({
  lines,
  removedLineIndexes,
}: {
  readonly lines: ReadonlyArray<string>;
  readonly removedLineIndexes: ReadonlySet<number>;
}): string {
  return pipe(
    lines,
    A.filter((_, index) => !removedLineIndexes.has(index)),
    (remainingLines) => remainingLines.join("\n"),
  );
}

export function removeSubgraphBlocks({
  nodeIds,
  source,
}: {
  readonly nodeIds: ReadonlySet<string>;
  readonly source: string;
}): string {
  if (nodeIds.size === 0) {
    return source;
  }

  const lines = source.split("\n");

  const removedLineIndexes = pipe(
    source,
    parseIndexedTopLevelSubgraphs,
    A.filter(({ block }) => nodeIds.has(block.id)),
    A.flatMap(({ block, endIndex, startIndex }) => {
      return getSubgraphRemovalIndexes({
        endIndex,
        id: block.id,
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

function isEmptyTopLevelSubgraph({ block }: IndexedSubgraphBlock): boolean {
  return pipe(
    block.text.split("\n").slice(1, -1),
    A.every((line) => line.trim().length === 0),
  );
}

export function getEmptyTopLevelNodeIds(source: string): ReadonlySet<string> {
  return pipe(
    source,
    parseIndexedTopLevelSubgraphs,
    A.filter(isEmptyTopLevelSubgraph),
    A.map(({ block }) => block.id),
    (nodeIds) => new Set(nodeIds),
  );
}

export function stripSubgraphMetadata({
  blocks,
  source,
}: {
  readonly blocks: ReadonlyArray<SubgraphBlock>;
  readonly source: string;
}): string {
  const nameById = pipe(
    blocks,
    A.map(({ id, name }) => [id, name] as const),
    (entries) => new Map(entries),
  );

  return pipe(
    source.split("\n"),
    A.map((line) => {
      const headerResult = decodeSubgraphHeader(line);

      if (Result.isFailure(headerResult)) {
        return line;
      }

      const { id } = headerResult.success;
      const name = nameById.get(id);

      if (name === undefined) {
        return line;
      }

      return `  subgraph ${id} ["\`${name}\`"]`;
    }),
    (lines) => lines.join("\n"),
  );
}
