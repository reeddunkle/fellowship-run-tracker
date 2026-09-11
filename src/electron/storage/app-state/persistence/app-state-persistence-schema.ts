import * as Schema from "effect/Schema";

import {
  type PersistedAppStateV1,
  PersistedAppStateV1Schema,
} from "./app-state-v1-schema.ts";

export const CURRENT_APP_STATE_VERSION = 1;

export const PersistedAppStateSchema = Schema.Union([
  PersistedAppStateV1Schema,
]);

export type PersistedAppState = typeof PersistedAppStateSchema.Type;

export type CurrentPersistedAppState = PersistedAppStateV1;
