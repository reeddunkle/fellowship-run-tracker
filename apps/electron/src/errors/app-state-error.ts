import * as Data from "effect/Data";
import type * as KeyValueStore from "effect/persistence/KeyValueStore";
import type * as Schema from "effect/Schema";

import { type AppStateRpcRequest } from "@frt/shared/app-state/app-state-rpc.ts";

export class AppStateInitializationError extends Data.TaggedError(
  "AppStateInitializationError",
)<{
  readonly cause: unknown;
}> {
  override get message() {
    return "Failed to initialize the app state.";
  }
}

export class AppStateClientError extends Data.TaggedError(
  "AppStateClientError",
)<{
  readonly cause: unknown;
  readonly operation: AppStateRpcRequest["_tag"];
}> {
  override get message() {
    return `App state request "${this.operation}" failed.`;
  }
}

export class AppStateStoreClosedError extends Data.TaggedError(
  "AppStateStoreClosedError",
) {
  override get message() {
    return "The app state store has shut down and can't save updates.";
  }
}

export type AppStateStoreError =
  | AppStateStoreClosedError
  | KeyValueStore.KeyValueStoreError
  | Schema.SchemaError;
