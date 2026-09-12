import * as Context from "effect/Context";
import type * as E from "effect/Effect";

import { type AppState as IAppState } from "@/electron/storage/app-state/app-state-schema.ts";

export class AppStateService extends Context.Service<
  AppStateService,
  {
    readonly get: E.Effect<IAppState, unknown>;
    readonly set: (state: IAppState) => E.Effect<void, unknown>;
  }
>()(
  "fellowship-run-tracker/services/app-state/app-state-service/AppStateService",
) {}

export type AppStateServiceShape = AppStateService["Service"];
