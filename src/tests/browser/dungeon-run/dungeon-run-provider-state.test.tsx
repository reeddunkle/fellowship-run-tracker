import * as E from "effect/Effect";
import * as Stream from "effect/Stream";
import { describe, expect, test } from "vitest";
import { render } from "vitest-browser-react";

import { API_CONNECTION_STATE } from "@/electron/renderer/api/common.ts";
import { type DungeonRunEventStreamEvent } from "@/electron/renderer/api/dungeon-run/dungeon-run-event-stream.ts";
import { makeDungeonRunEventStore } from "@/electron/renderer/stores/dungeon-run-store/dungeon-run-event-store.ts";
import {
  DungeonRunProvider,
  useDungeonRunServerState,
} from "@/electron/renderer/stores/dungeon-run-store/dungeon-run-provider.tsx";
import {
  MOCK_DUNGEON_RUN_API_MESSAGE,
  MOCK_DUNGEON_RUN_STATE_API,
} from "@/tests/common/fixtures/dungeon-run-api-fixtures.ts";

function DungeonRunServerStateConsumer() {
  const {
    connectionState,
    dungeonRun,
    history,
    latestObservation,
    observations,
  } = useDungeonRunServerState();

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
      <DungeonRunProvider
        eventStore={eventStore}
        history={null}
        invalidate={() => E.void}
      >
        <DungeonRunServerStateConsumer />
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
        eventStore={eventStore}
        history={null}
        invalidate={() => E.void}
      >
        <DungeonRunServerStateConsumer />
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
});
