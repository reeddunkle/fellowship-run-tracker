import * as Stream from "effect/Stream";
import { describe, expect, test } from "vitest";
import { render } from "vitest-browser-react";

import {
  MOCK_DUNGEON_RUN_API_MESSAGE,
  MOCK_DUNGEON_RUN_STATE_API,
} from "@frt/api/tests/common/fixtures/dungeon-run-api-fixtures.ts";

import { API_EVENT_CONNECTION_STATE } from "@/renderer/api/common.ts";
import { type DungeonRunEventStreamEvent } from "@/renderer/api/dungeon-run/dungeon-run-event-stream.ts";
import { makeDungeonRunEventStore } from "@/renderer/stores/dungeon-run/dungeon-run-event-store.ts";
import { useDungeonRunServerState } from "@/renderer/stores/dungeon-run/dungeon-run-provider.tsx";

import { TestDungeonRunProvider } from "./test-dungeon-run-provider.tsx";

function DungeonRunServerStateConsumer() {
  const {
    dungeonRun,
    eventConnectionState,
    history,
    latestObservation,
    observations,
  } = useDungeonRunServerState();

  return (
    <div>
      <div data-testid="event-connection-state">{eventConnectionState}</div>
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
    </div>
  );
}

describe("DungeonRunProvider server state", () => {
  test("provides its initial state", async () => {
    const eventStore = makeDungeonRunEventStore({
      makeEventStream: () => {
        return Stream.never;
      },
    });

    const screen = await render(
      <TestDungeonRunProvider eventStore={eventStore}>
        <DungeonRunServerStateConsumer />
      </TestDungeonRunProvider>,
    );

    await expect
      .element(screen.getByTestId("event-connection-state"))
      .toHaveTextContent(API_EVENT_CONNECTION_STATE.DISCONNECTED);

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
  });

  test("updates server state when the event store changes", async () => {
    const events = [
      {
        state: API_EVENT_CONNECTION_STATE.CONNECTED,
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
      <TestDungeonRunProvider eventStore={eventStore}>
        <DungeonRunServerStateConsumer />
      </TestDungeonRunProvider>,
    );

    eventStore.start();

    await expect
      .element(screen.getByTestId("event-connection-state"))
      .toHaveTextContent(API_EVENT_CONNECTION_STATE.CONNECTED);

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
});
