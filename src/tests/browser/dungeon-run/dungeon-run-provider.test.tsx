import * as E from "effect/Effect";
import * as Stream from "effect/Stream";
import { describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

import { API_CONNECTION_STATE } from "@/electron/renderer/api/common.ts";
import { type DungeonRunEventStreamEvent } from "@/electron/renderer/api/dungeon-run/dungeon-run-event-stream.ts";
import { type AppStore } from "@/electron/renderer/stores/app-state-store/app-state-store.ts";
import { makeDungeonRunEventStore } from "@/electron/renderer/stores/dungeon-run-store/dungeon-run-event-store.ts";
import {
  DungeonRunProvider,
  useDungeonRunDisplayState,
  useDungeonRunInterpretationState,
  useDungeonRunServerState,
} from "@/electron/renderer/stores/dungeon-run-store/dungeon-run-provider.tsx";
import {
  DEFAULT_APP_STATE,
  DUNGEON_RUN_TIME_COLUMN,
} from "@/electron/storage/app-state/app-state-schema.ts";
import { type DungeonRunApiHistory } from "@/services/api/dungeon-run/dungeon-run-api-schema.ts";
import { MOCK_CONFIGURATION_ID } from "@/tests/common/fixtures/configuration-fixtures.ts";
import {
  MOCK_DUNGEON_RUN_API_MESSAGE,
  MOCK_DUNGEON_RUN_STATE_API,
} from "@/tests/common/fixtures/dungeon-run-api-fixtures.ts";

function makeAppStoreTest(): AppStore {
  return {
    getSnapshot: () => {
      return DEFAULT_APP_STATE;
    },
    initialize: E.void,
    setDungeonRunVisibleTimeColumns: vi.fn(),
    setSelectedConfigurationId: vi.fn(),
    setSidebarOpen: vi.fn(),
    setTheme: vi.fn(),
    subscribe: () => {
      return () => {};
    },
  };
}

function DungeonRunProviderConsumer() {
  const {
    connectionState,
    dungeonRun,
    history,
    latestObservation,
    observations,
  } = useDungeonRunServerState();

  const {
    collapseAllMilestones,
    comparison,
    expandAllMilestones,
    isMilestoneExpanded,
    setComparison,
    setMilestoneExpanded,
    setTimeColumnVisible,
    visibleTimeColumns,
  } = useDungeonRunDisplayState();

  return (
    <div>
      <div data-testid="connection-state">{connectionState}</div>

      <div data-testid="dungeon-run">
        {dungeonRun === null ? "No dungeon run" : dungeonRun.status}
      </div>

      <div data-testid="history">
        {history === null ? "No history" : "Has history"}
      </div>

      <div data-testid="observation-count">{observations.length}</div>

      <div data-testid="latest-observation">
        {latestObservation?.targetId ?? "No observation"}
      </div>

      <div data-testid="comparison">{comparison}</div>

      <div data-testid="milestone-1">
        {isMilestoneExpanded("1") ? "Expanded" : "Collapsed"}
      </div>

      <div data-testid="delta-visible">
        {visibleTimeColumns.has(DUNGEON_RUN_TIME_COLUMN.DELTA)
          ? "Visible"
          : "Hidden"}
      </div>

      <button
        onClick={() => {
          setComparison("MEDIAN");
        }}
        type="button"
      >
        Use median
      </button>

      <button
        onClick={() => {
          setMilestoneExpanded("1", true);
        }}
        type="button"
      >
        Expand milestone
      </button>

      <button onClick={expandAllMilestones} type="button">
        Expand all
      </button>

      <button onClick={collapseAllMilestones} type="button">
        Collapse all
      </button>

      <button
        onClick={() => {
          setTimeColumnVisible(DUNGEON_RUN_TIME_COLUMN.DELTA, false);
        }}
        type="button"
      >
        Hide delta
      </button>
    </div>
  );
}

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

describe("DungeonRunProvider", () => {
  test("provides its initial state", async () => {
    const eventStore = makeDungeonRunEventStore({
      makeEventStream: () => {
        return Stream.never;
      },
    });

    const screen = await render(
      <DungeonRunProvider
        appStateStore={makeAppStoreTest()}
        eventStore={eventStore}
        history={null}
      >
        <DungeonRunProviderConsumer />
      </DungeonRunProvider>,
    );

    await expect
      .element(screen.getByTestId("connection-state"))
      .toHaveTextContent(API_CONNECTION_STATE.DISCONNECTED);

    await expect
      .element(screen.getByTestId("dungeon-run"))
      .toHaveTextContent("No dungeon run");

    await expect
      .element(screen.getByTestId("history"))
      .toHaveTextContent("No history");

    await expect
      .element(screen.getByTestId("observation-count"))
      .toHaveTextContent("0");

    await expect
      .element(screen.getByTestId("latest-observation"))
      .toHaveTextContent("No observation");

    await expect
      .element(screen.getByTestId("comparison"))
      .toHaveTextContent("BEST");

    await expect
      .element(screen.getByTestId("milestone-1"))
      .toHaveTextContent("Collapsed");
  });

  test("updates server state when the event store changes", async () => {
    const events = [
      {
        state: API_CONNECTION_STATE.CONNECTED,
        type: "CONNECTION_STATE_CHANGED",
      },
      {
        message: MOCK_DUNGEON_RUN_API_MESSAGE,
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
        appStateStore={makeAppStoreTest()}
        eventStore={eventStore}
        history={null}
      >
        <DungeonRunProviderConsumer />
      </DungeonRunProvider>,
    );

    eventStore.start();

    await expect
      .element(screen.getByTestId("connection-state"))
      .toHaveTextContent(API_CONNECTION_STATE.CONNECTED);

    await expect
      .element(screen.getByTestId("dungeon-run"))
      .toHaveTextContent(MOCK_DUNGEON_RUN_STATE_API.dungeonRun.status);

    await expect
      .element(screen.getByTestId("observation-count"))
      .toHaveTextContent(
        String(MOCK_DUNGEON_RUN_STATE_API.observations.length),
      );

    await expect
      .element(screen.getByTestId("latest-observation"))
      .toHaveTextContent(
        MOCK_DUNGEON_RUN_STATE_API.observations.at(-1)?.targetId ?? "",
      );
  });

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
        appStateStore={makeAppStoreTest()}
        eventStore={eventStore}
        history={history}
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
        appStateStore={makeAppStoreTest()}
        eventStore={eventStore}
        history={null}
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
        appStateStore={makeAppStoreTest()}
        eventStore={eventStore}
        history={history}
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

  test("updates comparison state", async () => {
    const eventStore = makeDungeonRunEventStore({
      makeEventStream: () => {
        return Stream.never;
      },
    });

    const screen = await render(
      <DungeonRunProvider
        appStateStore={makeAppStoreTest()}
        eventStore={eventStore}
        history={null}
      >
        <DungeonRunProviderConsumer />
      </DungeonRunProvider>,
    );

    await screen.getByRole("button", { name: "Use median" }).click();

    await expect
      .element(screen.getByTestId("comparison"))
      .toHaveTextContent("MEDIAN");
  });

  test("updates milestone expansion state", async () => {
    const eventStore = makeDungeonRunEventStore({
      makeEventStream: () => {
        return Stream.never;
      },
    });

    const screen = await render(
      <DungeonRunProvider
        appStateStore={makeAppStoreTest()}
        eventStore={eventStore}
        history={null}
      >
        <DungeonRunProviderConsumer />
      </DungeonRunProvider>,
    );

    await screen.getByRole("button", { name: "Expand milestone" }).click();

    await expect
      .element(screen.getByTestId("milestone-1"))
      .toHaveTextContent("Expanded");

    await screen.getByRole("button", { name: "Collapse all" }).click();

    await expect
      .element(screen.getByTestId("milestone-1"))
      .toHaveTextContent("Collapsed");

    await screen.getByRole("button", { name: "Expand all" }).click();

    await expect
      .element(screen.getByTestId("milestone-1"))
      .toHaveTextContent("Expanded");
  });

  test("persists visible time column changes through the app store", async () => {
    const setDungeonRunVisibleTimeColumns = vi.fn();

    const appStateStore = {
      ...makeAppStoreTest(),
      setDungeonRunVisibleTimeColumns,
    } satisfies AppStore;

    const eventStore = makeDungeonRunEventStore({
      makeEventStream: () => {
        return Stream.never;
      },
    });

    const screen = await render(
      <DungeonRunProvider
        appStateStore={appStateStore}
        eventStore={eventStore}
        history={null}
      >
        <DungeonRunProviderConsumer />
      </DungeonRunProvider>,
    );

    await screen.getByRole("button", { name: "Hide delta" }).click();

    expect(setDungeonRunVisibleTimeColumns).toHaveBeenCalledOnce();

    expect(setDungeonRunVisibleTimeColumns).toHaveBeenCalledWith(
      expect.not.arrayContaining([DUNGEON_RUN_TIME_COLUMN.DELTA]),
    );
  });
});
