import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import { describe, test } from "vitest";

import { getEventType } from "@frt/api/services/fellowship/parsing/get-event-type.ts";
import { parseFellowshipEventStream } from "@frt/api/services/fellowship/parsing/parse-fellowship-event-stream.ts";
import {
  EVERDAWN_GROVE_64_TIMED_LOG_PATH,
  readFellowshipLogLines,
} from "@frt/api/tests/common/fixtures/fellowship-log-fixtures.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import {
  fellowshipEventSchemas,
  isParsedFellowshipEventType,
} from "@frt/shared/fellowship/validation/fellowship-event-schema.ts";

export function describeParseFellowshipLogBenchmarks(suiteName: string): void {
  describe(suiteName, async () => {
    const lines = await runTest(
      readFellowshipLogLines(EVERDAWN_GROVE_64_TIMED_LOG_PATH),
    );

    const decodersByLine = lines.flatMap((line) => {
      const fields = line.split("|");
      const eventType = getEventType(fields);

      return isParsedFellowshipEventType(eventType)
        ? [
            {
              decode: Schema.decodeUnknownSync(
                fellowshipEventSchemas[eventType],
              ),
              fields,
            },
          ]
        : [];
    });

    test("event schema decode", async ({ bench }) => {
      await bench("event schema decode", () => {
        decodersByLine.forEach(({ decode, fields }) => {
          decode(fields);
        });
      }).run();
    });

    test("parseFellowshipEventStream from memory", async ({ bench }) => {
      await bench("parseFellowshipEventStream from memory", async () => {
        await runTest(
          Stream.fromIterable(lines).pipe(
            parseFellowshipEventStream,
            Stream.runCount,
          ),
        );
      }).run();
    });
  });
}
