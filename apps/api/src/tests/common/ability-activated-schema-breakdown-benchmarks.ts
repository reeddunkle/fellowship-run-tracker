import * as Schema from "effect/Schema";
import { describe, test } from "vitest";

import {
  EVERDAWN_GROVE_64_TIMED_LOG_PATH,
  readFellowshipLogLines,
} from "@frt/api/tests/common/fixtures/fellowship-log-fixtures.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { FELLOWSHIP_EVENT } from "@frt/shared/fellowship/constants/fellowship-event.ts";
import { AbilityActivatedEventFromLogSchema } from "@frt/shared/fellowship/validation/events/ability-activated.ts";
import {
  IntegerFromStringSchema,
  JsonStringSchema,
} from "@frt/shared/util/common-schemas.ts";

const AbilityActivatedLogLineSchema = Schema.Tuple([
  Schema.DateTimeUtcFromString,
  Schema.Literal(FELLOWSHIP_EVENT.ABILITY_ACTIVATED),
  Schema.String,
  JsonStringSchema,
  Schema.String,
  JsonStringSchema,
  IntegerFromStringSchema,
  Schema.String,
  JsonStringSchema,
  IntegerFromStringSchema,
  IntegerFromStringSchema,
  IntegerFromStringSchema,
  Schema.FiniteFromString,
  Schema.FiniteFromString,
  Schema.FiniteFromString,
  Schema.String,
]);

const NestedIntegerFromStringSchema = Schema.FiniteFromString.pipe(
  Schema.decodeTo(Schema.Int),
);
const fieldIndexes = {
  finite: [12, 13, 14],
  integer: [6, 9, 10, 11],
  jsonString: [3, 5, 8],
  string: [2, 4, 7, 15],
  timestamp: [0],
};

function pickFields(
  fieldsByLine: ReadonlyArray<ReadonlyArray<string>>,
  indexes: ReadonlyArray<number>,
): ReadonlyArray<ReadonlyArray<string | undefined>> {
  return fieldsByLine.map((fields) => {
    return indexes.map((index) => fields[index]);
  });
}

function makeDecodeAll(
  schema: Schema.Codec<unknown, unknown>,
  inputs: ReadonlyArray<unknown>,
): () => void {
  const decode = Schema.decodeUnknownSync(schema);

  return () => {
    inputs.forEach((input) => {
      decode(input);
    });
  };
}

function repeatTuple(
  schema: Schema.Codec<unknown, string>,
  length: number,
): Schema.Codec<unknown, unknown> {
  return Schema.Tuple(Array.from({ length }, () => schema));
}

export function describeAbilityActivatedSchemaBreakdownBenchmarks(
  suiteName: string,
): void {
  describe(suiteName, async () => {
    const lines = await runTest(
      readFellowshipLogLines(EVERDAWN_GROVE_64_TIMED_LOG_PATH),
    );

    const fieldsByLine = lines
      .map((line) => line.split("|"))
      .filter((fields) => fields[1] === FELLOWSHIP_EVENT.ABILITY_ACTIVATED);

    const decodeEvent = Schema.decodeUnknownSync(
      AbilityActivatedEventFromLogSchema,
    );

    const events = fieldsByLine.map((fields) => decodeEvent(fields));

    test("ABILITY_ACTIVATED schema cost by part", async ({ bench }) => {
      await bench.compare(
        bench(
          "full event schema",
          makeDecodeAll(AbilityActivatedEventFromLogSchema, fieldsByLine),
        ),
        bench(
          "line tuple only",
          makeDecodeAll(AbilityActivatedLogLineSchema, fieldsByLine),
        ),
        bench(
          "event struct validation only",
          makeDecodeAll(
            Schema.toType(AbilityActivatedEventFromLogSchema),
            events,
          ),
        ),
        bench(
          "timestamp x1",
          makeDecodeAll(
            repeatTuple(Schema.DateTimeUtcFromString, 1),
            pickFields(fieldsByLine, fieldIndexes.timestamp),
          ),
        ),
        bench(
          "JsonStringSchema x3",
          makeDecodeAll(
            repeatTuple(JsonStringSchema, 3),
            pickFields(fieldsByLine, fieldIndexes.jsonString),
          ),
        ),
        bench(
          "IntegerFromStringSchema x4",
          makeDecodeAll(
            repeatTuple(IntegerFromStringSchema, 4),
            pickFields(fieldsByLine, fieldIndexes.integer),
          ),
        ),
        bench(
          "FiniteFromString decodeTo Int x4",
          makeDecodeAll(
            repeatTuple(NestedIntegerFromStringSchema, 4),
            pickFields(fieldsByLine, fieldIndexes.integer),
          ),
        ),
        bench(
          "FiniteFromString x3",
          makeDecodeAll(
            repeatTuple(Schema.FiniteFromString, 3),
            pickFields(fieldsByLine, fieldIndexes.finite),
          ),
        ),
        bench(
          "String x4",
          makeDecodeAll(
            repeatTuple(Schema.String, 4),
            pickFields(fieldsByLine, fieldIndexes.string),
          ),
        ),
      );
    });
  });
}
