import { describe, expect, test } from "vitest";

import {
  decodeFellowshipLogFile,
  EVERDAWN_GROVE_64_TIMED_EVENTS_SNAPSHOT_PATH,
  EVERDAWN_GROVE_64_TIMED_LOG_PATH,
  formatFellowshipEventsSnapshot,
} from "@frt/api/tests/common/fixtures/fellowship-log-fixtures.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";

describe("parseFellowshipEventStream with interpreted schemas", () => {
  test("decodes every event in the Everdawn Grove fixture", async () => {
    const events = await runTest(
      decodeFellowshipLogFile(EVERDAWN_GROVE_64_TIMED_LOG_PATH),
    );

    await expect(formatFellowshipEventsSnapshot(events)).toMatchFileSnapshot(
      EVERDAWN_GROVE_64_TIMED_EVENTS_SNAPSHOT_PATH,
    );
  });
});
