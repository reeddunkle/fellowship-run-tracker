import * as E from "effect/Effect";
import * as Stream from "effect/Stream";
import { describe, expect, test } from "vitest";
import { render } from "vitest-browser-react";

import { makeDungeonRunEventStore } from "@/electron/renderer/stores/dungeon-run-store/dungeon-run-event-store.ts";
import {
  DungeonRunProvider,
  useDungeonRunDisplayState,
} from "@/electron/renderer/stores/dungeon-run-store/dungeon-run-provider.tsx";

function DungeonRunDisplayConsumer() {
  const {
    collapseAllMilestones,
    expandAllMilestones,
    isMilestoneExpanded,
    setMilestoneExpanded,
  } = useDungeonRunDisplayState();

  return (
    <div>
      <div data-testid="milestone-1">
        {isMilestoneExpanded("1") ? "Expanded" : "Collapsed"}
      </div>

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
    </div>
  );
}

describe("DungeonRunProvider display state", () => {
  test("starts milestones collapsed", async () => {
    const eventStore = makeDungeonRunEventStore({
      makeEventStream: () => {
        return Stream.never;
      },
    });

    const screen = await render(
      <DungeonRunProvider
        eventStore={eventStore}
        history={null}
        historyKey={null}
        invalidate={() => E.void}
      >
        <DungeonRunDisplayConsumer />
      </DungeonRunProvider>,
    );

    await expect
      .element(screen.getByTestId("milestone-1"))
      .toHaveTextContent("Collapsed");
  });

  test("updates milestone expansion state", async () => {
    const eventStore = makeDungeonRunEventStore({
      makeEventStream: () => {
        return Stream.never;
      },
    });

    const screen = await render(
      <DungeonRunProvider
        eventStore={eventStore}
        history={null}
        historyKey={null}
        invalidate={() => E.void}
      >
        <DungeonRunDisplayConsumer />
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
});
