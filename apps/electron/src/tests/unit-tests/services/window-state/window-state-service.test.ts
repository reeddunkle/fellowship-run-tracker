import * as E from "effect/Effect";
import * as Option from "effect/Option";
import * as KeyValueStore from "effect/unstable/persistence/KeyValueStore";
import { describe, expect, test } from "vitest";

import { runTest } from "@frt/api/tests/common/run-test.ts";

import { makeWindowState } from "@/services/window-state/window-state-service.ts";

describe("WindowState", () => {
  test("round-trips the saved main window state", async () => {
    const savedState = {
      bounds: { height: 900, width: 1200, x: 100, y: 50 },
      isMaximized: true,
      zoomLevel: 0.5,
    };
    const program = E.gen(function* () {
      const windowState = yield* makeWindowState;

      expect(yield* windowState.getMainWindowState).toEqual(Option.none());

      yield* windowState.setMainWindowState(savedState);

      expect(yield* windowState.getMainWindowState).toEqual(
        Option.some(savedState),
      );
    }).pipe(E.provide(KeyValueStore.layerMemory));

    await runTest(program);
  });

  test("stores the detached window bounds separately", async () => {
    const detachedState = {
      bounds: { height: 400, width: 900, x: 2700, y: 40 },
    };
    const program = E.gen(function* () {
      const windowState = yield* makeWindowState;

      yield* windowState.setDetachedWindowState(detachedState);

      expect(yield* windowState.getDetachedWindowState).toEqual(
        Option.some(detachedState),
      );
      expect(yield* windowState.getMainWindowState).toEqual(Option.none());
    }).pipe(E.provide(KeyValueStore.layerMemory));

    await runTest(program);
  });

  test("falls back to no saved state when persisted data is invalid", async () => {
    const program = E.gen(function* () {
      const keyValueStore = yield* KeyValueStore.KeyValueStore;
      yield* keyValueStore.set("main-window-state", "not valid json");
      yield* keyValueStore.set("detached-window-state", '{"x":"left"}');

      const windowState = yield* makeWindowState;

      expect(yield* windowState.getMainWindowState).toEqual(Option.none());
      expect(yield* windowState.getDetachedWindowState).toEqual(Option.none());
    }).pipe(E.provide(KeyValueStore.layerMemory));

    await runTest(program);
  });
});
