import * as Schema from "effect/Schema";

import { AppStateSchema } from "@/contracts/app-state/app-state-schema.ts";

export const PersistedAppStateV1Schema = Schema.Struct({
  state: AppStateSchema,
  version: Schema.Literal(1),
});

export type PersistedAppStateV1 = typeof PersistedAppStateV1Schema.Type;
