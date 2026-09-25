import * as Data from "effect/Data";
import type * as Schema from "effect/Schema";
import type * as KeyValueStore from "effect/unstable/persistence/KeyValueStore";

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

export type AppStateStoreError =
  | KeyValueStore.KeyValueStoreError
  | Schema.SchemaError;
