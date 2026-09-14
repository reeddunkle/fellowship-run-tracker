import * as Context from "effect/Context";
import type * as E from "effect/Effect";
import type * as Option from "effect/Option";
import type * as Schema from "effect/Schema";
import type * as SqlError from "effect/unstable/sql/SqlError";

import { type AppSettingsModel } from "@/db/models/app-settings-model.ts";
import {
  type FellowshipLogDirectory,
  type LiveSplitHost,
  type LiveSplitPort,
} from "@/validation/app-settings/app-settings-schema.ts";

export type AppSettingsDAOError = SqlError.SqlError | Schema.SchemaError;

type AppSettingsDAOValue = {
  readonly fellowshipLogDirectory: FellowshipLogDirectory;
  readonly isLiveSplitEnabled: boolean;
  readonly liveSplitsHost: LiveSplitHost;
  readonly liveSplitsPort: LiveSplitPort;
};

export type AppSettingsDAOShape = {
  readonly get: () => E.Effect<
    Option.Option<AppSettingsModel>,
    AppSettingsDAOError
  >;

  readonly insert: (
    appSettings: AppSettingsDAOValue,
  ) => E.Effect<void, AppSettingsDAOError>;

  readonly update: (
    appSettings: AppSettingsDAOValue,
  ) => E.Effect<void, AppSettingsDAOError>;
};

export class AppSettingsDAO extends Context.Service<
  AppSettingsDAO,
  AppSettingsDAOShape
>()(
  "fellowship-run-tracker/db/daos/app-settings/app-settings-dao/AppSettingsDAO",
) {}
