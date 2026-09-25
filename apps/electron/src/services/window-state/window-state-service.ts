import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import type * as Schema from "effect/Schema";
import * as KeyValueStore from "effect/unstable/persistence/KeyValueStore";

import { NodePlatformLayer } from "@frt/api/layers/node-platform-layer.ts";

import {
  DetachedWindowStateSchema,
  type DetachedWindowStateValue,
  MainWindowStateSchema,
  type MainWindowStateValue,
} from "./window-state-schema.ts";

const MAIN_WINDOW_STATE_KEY = "main-window-state";
const DETACHED_WINDOW_STATE_KEY = "detached-window-state";

export type WindowStateShape = {
  readonly getDetachedWindowState: E.Effect<
    Option.Option<DetachedWindowStateValue>
  >;
  readonly getMainWindowState: E.Effect<Option.Option<MainWindowStateValue>>;
  readonly setDetachedWindowState: (
    state: DetachedWindowStateValue,
  ) => E.Effect<void>;
  readonly setMainWindowState: (state: MainWindowStateValue) => E.Effect<void>;
};

function makeWindowStateAccessors<S extends Schema.Constraint>({
  key,
  keyValueStore,
  schema,
}: {
  readonly key: string;
  readonly keyValueStore: KeyValueStore.KeyValueStore;
  readonly schema: S;
}) {
  const schemaStore = KeyValueStore.toSchemaStore(keyValueStore, schema);

  const get = schemaStore.get(key).pipe(
    E.catch((error) => {
      return E.logWarning(
        "Unable to read persisted window state. Using defaults.",
        { error, key },
      ).pipe(E.as(Option.none<S["Type"]>()));
    }),
  );

  const set = (state: S["Type"]) => {
    return schemaStore.set(key, state).pipe(
      E.catch((error) => {
        return E.logWarning("Failed to save window state.", { error, key });
      }),
    );
  };

  return { get, set };
}

export const makeWindowState = E.gen(function* () {
  const keyValueStore = yield* KeyValueStore.KeyValueStore;

  const mainWindowState = makeWindowStateAccessors({
    key: MAIN_WINDOW_STATE_KEY,
    keyValueStore,
    schema: MainWindowStateSchema,
  });

  const detachedWindowState = makeWindowStateAccessors({
    key: DETACHED_WINDOW_STATE_KEY,
    keyValueStore,
    schema: DetachedWindowStateSchema,
  });

  return {
    getDetachedWindowState: detachedWindowState.get,
    getMainWindowState: mainWindowState.get,
    setDetachedWindowState: detachedWindowState.set,
    setMainWindowState: mainWindowState.set,
  } satisfies WindowStateShape;
});

export class WindowState extends Context.Service<
  WindowState,
  WindowStateShape
>()("@frt/electron/services/window-state/window-state-service/WindowState") {
  static readonly layerWith = (directoryPath: string) =>
    Layer.effect(this, makeWindowState).pipe(
      Layer.provide(KeyValueStore.layerFileSystem(directoryPath)),
      Layer.provide(NodePlatformLayer),
    );
}
