import * as E from "effect/Effect";
import * as Stream from "effect/Stream";
import { describe, expect, test } from "vitest";
import { render } from "vitest-browser-react";

import { type DungeonRunEventStreamEvent } from "@/electron/renderer/api/dungeon-run/dungeon-run-event-stream.ts";
import { makeDungeonRunEventStore } from "@/electron/renderer/stores/dungeon-run-store/dungeon-run-event-store.ts";
import {
  DungeonRunProvider,
  useDungeonRunInterpretationState,
} from "@/electron/renderer/stores/dungeon-run-store/dungeon-run-provider.tsx";
import { type DungeonRunApiHistory } from "@/services/api/dungeon-run/dungeon-run-api-schema.ts";
import { MOCK_CONFIGURATION_ID } from "@/tests/common/fixtures/configuration-fixtures.ts";
import {
  MOCK_DUNGEON_RUN_API_MESSAGE,
  MOCK_DUNGEON_RUN_STATE_API,
} from "@/tests/common/fixtures/dungeon-run-api-fixtures.ts";

function DungeonRunInterpretationConsumer() {
  const { latestObservation, observations } =
    useDungeonRunInterpretationState();

  const firstObservation = observations[0];
  const secondObservation = observations[1];

  return (
    <div>
      <div data-testid="first-occurrence">
        {firstObservation?.occurrence ?? "None"}
      </div>

      <div data-testid="first-best">
        {firstObservation?.analytics?.bestElapsedMilliseconds ?? "None"}
      </div>

      <div data-testid="first-mean">
        {firstObservation?.analytics?.meanElapsedMilliseconds ?? "None"}
      </div>

      <div data-testid="first-median">
        {firstObservation?.analytics?.medianElapsedMilliseconds ?? "None"}
      </div>

      <div data-testid="first-sample-count">
        {firstObservation?.analytics?.sampleCount ?? "None"}
      </div>

      <div data-testid="first-elapsed-from-start">
        {firstObservation?.elapsedFromStartMilliseconds ?? "None"}
      </div>

      <div data-testid="first-elapsed-from-previous">
        {firstObservation?.elapsedFromPreviousObservationMilliseconds ?? "None"}
      </div>

      <div data-testid="second-occurrence">
        {secondObservation?.occurrence ?? "None"}
      </div>

      <div data-testid="second-best">
        {secondObservation?.analytics?.bestElapsedMilliseconds ?? "None"}
      </div>

      <div data-testid="second-mean">
        {secondObservation?.analytics?.meanElapsedMilliseconds ?? "None"}
      </div>

      <div data-testid="second-median">
        {secondObservation?.analytics?.medianElapsedMilliseconds ?? "None"}
      </div>

      <div data-testid="second-sample-count">
        {secondObservation?.analytics?.sampleCount ?? "None"}
      </div>

      <div data-testid="second-elapsed-from-start">
        {secondObservation?.elapsedFromStartMilliseconds ?? "None"}
      </div>

      <div data-testid="second-elapsed-from-previous">
        {secondObservation?.elapsedFromPreviousObservationMilliseconds ??
          "None"}
      </div>

      <div data-testid="latest-occurrence">
        {latestObservation?.occurrence ?? "None"}
      </div>
    </div>
  );
}

describe("DungeonRunProvider interpretation state", () => {
  test("matches historical analytics by observation occurrence", async () => {
    const observation = MOCK_DUNGEON_RUN_STATE_API.observations[0];

    if (observation === undefined) {
      throw new Error("Expected a dungeon run observation fixture.");
    }

    const firstObservation = {
      ...observation,
      timestampMilliseconds: 10_000,
    };

    const secondObservation = {
      ...observation,
      timestampMilliseconds: 15_000,
    };

    const message = {
      ...MOCK_DUNGEON_RUN_API_MESSAGE,
      state: {
        ...MOCK_DUNGEON_RUN_STATE_API,
        dungeonRun: {
          ...MOCK_DUNGEON_RUN_STATE_API.dungeonRun,
          startedAtMilliseconds: 1_000,
        },
        observations: [firstObservation, secondObservation],
      },
    };

    const history = {
      configurationId: MOCK_CONFIGURATION_ID,
      observations: [
        {
          bestElapsedMilliseconds: 8_000,
          meanElapsedMilliseconds: 9_000,
          medianElapsedMilliseconds: 8_500,
          occurrence: 1,
          sampleCount: 10,
          targetId: observation.targetId,
          type: observation.type,
        },
        {
          bestElapsedMilliseconds: 12_000,
          meanElapsedMilliseconds: 14_000,
          medianElapsedMilliseconds: 13_000,
          occurrence: 2,
          sampleCount: 5,
          targetId: observation.targetId,
          type: observation.type,
        },
      ],
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
      <DungeonRunProvider
        eventStore={eventStore}
        history={history}
        invalidate={() => E.void}
      >
        <DungeonRunInterpretationConsumer />
      </DungeonRunProvider>,
    );

    eventStore.start();

    await expect
      .element(screen.getByTestId("first-occurrence"))
      .toHaveTextContent("1");

    await expect
      .element(screen.getByTestId("first-best"))
      .toHaveTextContent("8000");

    await expect
      .element(screen.getByTestId("first-mean"))
      .toHaveTextContent("9000");

    await expect
      .element(screen.getByTestId("first-median"))
      .toHaveTextContent("8500");

    await expect
      .element(screen.getByTestId("first-sample-count"))
      .toHaveTextContent("10");

    await expect
      .element(screen.getByTestId("second-occurrence"))
      .toHaveTextContent("2");

    await expect
      .element(screen.getByTestId("second-best"))
      .toHaveTextContent("12000");

    await expect
      .element(screen.getByTestId("second-mean"))
      .toHaveTextContent("14000");

    await expect
      .element(screen.getByTestId("second-median"))
      .toHaveTextContent("13000");

    await expect
      .element(screen.getByTestId("second-sample-count"))
      .toHaveTextContent("5");

    await expect
      .element(screen.getByTestId("latest-occurrence"))
      .toHaveTextContent("2");
  });

  test("calculates elapsed times for interpreted observations", async () => {
    const observation = MOCK_DUNGEON_RUN_STATE_API.observations[0];

    if (observation === undefined) {
      throw new Error("Expected a dungeon run observation fixture.");
    }

    const message = {
      ...MOCK_DUNGEON_RUN_API_MESSAGE,
      state: {
        ...MOCK_DUNGEON_RUN_STATE_API,
        dungeonRun: {
          ...MOCK_DUNGEON_RUN_STATE_API.dungeonRun,
          startedAtMilliseconds: 1_000,
        },
        observations: [
          {
            ...observation,
            timestampMilliseconds: 10_000,
          },
          {
            ...observation,
            timestampMilliseconds: 15_000,
          },
        ],
      },
    };

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
      <DungeonRunProvider
        eventStore={eventStore}
        history={null}
        invalidate={() => E.void}
      >
        <DungeonRunInterpretationConsumer />
      </DungeonRunProvider>,
    );

    eventStore.start();

    await expect
      .element(screen.getByTestId("first-elapsed-from-start"))
      .toHaveTextContent("9000");

    await expect
      .element(screen.getByTestId("first-elapsed-from-previous"))
      .toHaveTextContent("None");

    await expect
      .element(screen.getByTestId("second-elapsed-from-start"))
      .toHaveTextContent("14000");

    await expect
      .element(screen.getByTestId("second-elapsed-from-previous"))
      .toHaveTextContent("5000");
  });

  test("does not attach analytics when historical statistics do not match the occurrence", async () => {
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
      configurationId: MOCK_CONFIGURATION_ID,
      observations: [
        {
          bestElapsedMilliseconds: 8_000,
          meanElapsedMilliseconds: 9_000,
          medianElapsedMilliseconds: 8_500,
          occurrence: 2,
          sampleCount: 10,
          targetId: observation.targetId,
          type: observation.type,
        },
      ],
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
      <DungeonRunProvider
        eventStore={eventStore}
        history={history}
        invalidate={() => E.void}
      >
        <DungeonRunInterpretationConsumer />
      </DungeonRunProvider>,
    );

    eventStore.start();

    await expect
      .element(screen.getByTestId("first-occurrence"))
      .toHaveTextContent("1");

    await expect
      .element(screen.getByTestId("first-best"))
      .toHaveTextContent("None");

    await expect
      .element(screen.getByTestId("first-mean"))
      .toHaveTextContent("None");

    await expect
      .element(screen.getByTestId("first-median"))
      .toHaveTextContent("None");
  });
});
