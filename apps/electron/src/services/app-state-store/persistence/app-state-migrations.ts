import * as Match from "effect/Match";

import {
  type CurrentPersistedAppState,
  type PersistedAppState,
} from "./app-state-persistence-schema.ts";
import { type PersistedAppStateV1 } from "./app-state-v1-schema.ts";

function migrateV1ToCurrent(
  persistedAppState: PersistedAppStateV1,
): CurrentPersistedAppState {
  return persistedAppState;
}

export function migratePersistedAppState(
  persistedAppState: PersistedAppState,
): CurrentPersistedAppState {
  return Match.value(persistedAppState).pipe(
    Match.when({ version: 1 }, migrateV1ToCurrent),
    Match.exhaustive,
  );
}
