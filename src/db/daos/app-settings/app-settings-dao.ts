import * as Context from "effect/Context";
import type * as E from "effect/Effect";
import type * as Option from "effect/Option";
import type * as Schema from "effect/Schema";
import type * as SqlError from "effect/unstable/sql/SqlError";

import { type AppSettingsModel } from "@/db/models/app-settings-model.ts";
import { type EncryptedValue } from "@/services/encryption/validation/encrypted-value-schema.ts";
import {
  type FellowshipLogDirectory,
  type FellowshipLogsClientId,
  type LiveSplitHost,
  type LiveSplitPort,
} from "@/validation/app-settings/app-settings-schema.ts";

export type AppSettingsDAOError = SqlError.SqlError | Schema.SchemaError;

type AppSettingsDAOValue = {
  readonly fellowshipLogDirectory: FellowshipLogDirectory;
  readonly fellowshipLogsClientId: FellowshipLogsClientId | null;
  readonly fellowshipLogsClientSecret: EncryptedValue | null;
  readonly isLiveSplitEnabled: boolean;
  readonly liveSplitHost: LiveSplitHost;
  readonly liveSplitPort: LiveSplitPort;
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
