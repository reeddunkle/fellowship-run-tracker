import * as E from "effect/Effect";
import * as Schema from "effect/Schema";
import * as SchemaGetter from "effect/SchemaGetter";
import * as SchemaIssue from "effect/SchemaIssue";

const TSGO_SUBGRAPH_HEADER_PATTERN =
  /^ {2}subgraph (?<id>\S+) \["`(?<name>[^<]+)<br\/>/;

const MERMAID_SUBGRAPH_HEADER_PATTERN =
  /^ {2}subgraph (?<id>\S+) \["`(?<name>[^`]+)`"\]\s*$/;

const SUBGRAPH_START_PATTERN = /^\s*subgraph\b/;
const SUBGRAPH_END_PATTERN = /^\s*end\s*$/;

const SubgraphHeaderValueSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  name: Schema.NonEmptyString,
});

const makeSubgraphHeaderSchema = ({
  errorMessage,
  pattern,
}: {
  readonly errorMessage: string;
  readonly pattern: RegExp;
}) => {
  return Schema.String.pipe(
    Schema.decodeTo(SubgraphHeaderValueSchema, {
      decode: SchemaGetter.transformOrFail((line, options) => {
        const match = pattern.exec(line);
        const id = match?.groups?.id;
        const name = match?.groups?.name;

        if (id === undefined || name === undefined) {
          return E.fail(
            new SchemaIssue.InvalidValue(
              {
                message: errorMessage,
              },
              line,
              options,
            ),
          );
        }

        return E.succeed({
          id,
          name,
        });
      }),
      encode: SchemaGetter.forbidden(() => {
        return "Subgraph headers cannot be encoded back to Mermaid source.";
      }),
    }),
  );
};

export const TsGoSubgraphHeaderSchema = makeSubgraphHeaderSchema({
  errorMessage: "Expected an Effect TS-Go Mermaid subgraph header",
  pattern: TSGO_SUBGRAPH_HEADER_PATTERN,
});

export const MermaidSubgraphHeaderSchema = makeSubgraphHeaderSchema({
  errorMessage: "Expected a normalized Mermaid subgraph header",
  pattern: MERMAID_SUBGRAPH_HEADER_PATTERN,
});

export const SubgraphHeaderSchema = Schema.Union([
  TsGoSubgraphHeaderSchema,
  MermaidSubgraphHeaderSchema,
]);

export const SubgraphStartLineSchema = Schema.String.check(
  Schema.isPattern(SUBGRAPH_START_PATTERN),
);

export const SubgraphEndLineSchema = Schema.String.check(
  Schema.isPattern(SUBGRAPH_END_PATTERN),
);

export const SubgraphBlockSchema = Schema.Struct({
  id: Schema.NonEmptyString,
  name: Schema.NonEmptyString,
  text: Schema.NonEmptyString,
});

export type SubgraphHeader = typeof SubgraphHeaderSchema.Type;
export type SubgraphBlock = typeof SubgraphBlockSchema.Type;
