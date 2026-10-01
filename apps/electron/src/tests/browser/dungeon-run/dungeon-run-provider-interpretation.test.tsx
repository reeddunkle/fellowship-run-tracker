import * as Stream from "effect/Stream";
import { describe, expect, test } from "vitest";
import { render } from "vitest-browser-react";

import {
  MOCK_DUNGEON_RUN_API_MESSAGE,
  MOCK_DUNGEON_RUN_STATE_API,
} from "@frt/api/tests/common/fixtures/dungeon-run-api-fixtures.ts";
import { MOCK_CONFIGURATION_WITH_MULTIPLE_MILESTONES } from "@frt/db/tests/common/fixtures/configuration-fixtures.ts";
import { type DungeonRunApiHistory } from "@frt/shared/dungeon-run/dungeon-run-api-schema.ts";

import { type DungeonRunEventStreamEvent } from "@/renderer/api/dungeon-run/dungeon-run-event-stream.ts";
import { makeDungeonRunEventStore } from "@/renderer/stores/dungeon-run/dungeon-run-event-store.ts";
import { useDungeonRunInterpretationState } from "@/renderer/stores/dungeon-run/dungeon-run-provider.tsx";

import { TestDungeonRunProvider } from "./test-dungeon-run-provider.tsx";

const HISTORY_KEY = {
  dungeonId: MOCK_CONFIGURATION_WITH_MULTIPLE_MILESTONES.dungeonId,
  dungeonLevel: MOCK_CONFIGURATION_WITH_MULTIPLE_MILESTONES.dungeonLevel,
};

function DungeonRunInterpretationConsumer() {
  const { observations } = useDungeonRunInterpretationState();

  const firstObservation = observations[0];

  return (
    <div>
      <div data-testid="first-best">
        {firstObservation?.analytics?.bestElapsedMilliseconds ?? "None"}
      </div>
      <div data-testid="first-mean">
        {firstObservation?.analytics?.meanElapsedMilliseconds ?? "None"}
      </div>
      <div data-testid="first-sample-count">
        {firstObservation?.analytics?.sampleCount ?? "None"}
      </div>
    </div>
  );
}

describe("DungeonRunProvider interpretation state", () => {
  test("uses the app state's selected comparison group to pick historical statistics", async () => {
    const observation = MOCK_DUNGEON_RUN_STATE_API.observations[0];

    if (observation === undefined) {
      throw new Error("Expected a dungeon run observation fixture.");
    }

    const message = {
      ...MOCK_DUNGEON_RUN_API_MESSAGE,
      state: {
        ...MOCK_DUNGEON_RUN_STATE_API,
        observations: [observation],
      },
    };

    const history = {
      comparisonRunCount: 5,
      comparisonSampleCount: 5,
      observations: [
        {
          bestElapsedMilliseconds: 5_000,
          comparisonGroup: "ALL",
          meanElapsedMilliseconds: 6_500,
          medianElapsedMilliseconds: 6_500,
          occurrence: 1,
          sampleCount: 15,
          targetId: observation.targetId,
          type: observation.type,
        },
        {
          bestElapsedMilliseconds: 6_000,
          comparisonGroup: "COMPARISON",
          meanElapsedMilliseconds: 7_000,
          medianElapsedMilliseconds: 7_000,
          occurrence: 1,
          sampleCount: 5,
          targetId: observation.targetId,
          type: observation.type,
        },
        {
          bestElapsedMilliseconds: 8_000,
          comparisonGroup: "OWN",
          meanElapsedMilliseconds: 9_000,
          medianElapsedMilliseconds: 8_500,
          occurrence: 1,
          sampleCount: 10,
          targetId: observation.targetId,
          type: observation.type,
        },
      ],
      ownRunCount: 10,
      ownSampleCount: 10,
    } satisfies DungeonRunApiHistory;

    const events = [
      {
        message,
        type: "MESSAGE_RECEIVED",
      },
    ] satisfies ReadonlyArray<DungeonRunEventStreamEvent>;

    const eventStore = makeDungeonRunEventStore({
      makeEventStream: () => {
        return Stream.fromIterable(events);
      },
    });

    const screen = await render(
      <TestDungeonRunProvider
        comparisonGroup="ALL"
        configurations={[MOCK_CONFIGURATION_WITH_MULTIPLE_MILESTONES]}
        eventStore={eventStore}
        history={{ ...HISTORY_KEY, value: history }}
        selectedConfigurationId={MOCK_CONFIGURATION_WITH_MULTIPLE_MILESTONES.id}
      >
        <DungeonRunInterpretationConsumer />
      </TestDungeonRunProvider>,
    );

    eventStore.start();

    await expect
      .element(screen.getByTestId("first-best"))
      .toHaveTextContent("5000");

    await expect
      .element(screen.getByTestId("first-mean"))
      .toHaveTextContent("6500");

    await expect
      .element(screen.getByTestId("first-sample-count"))
      .toHaveTextContent("15");
  });
});
