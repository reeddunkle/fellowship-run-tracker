import * as Context from "effect/Context";
import type * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as Option from "effect/Option";
import type * as Schema from "effect/Schema";
import type * as SqlError from "effect/unstable/sql/SqlError";

import { makeAppSettingDAO } from "@frt/db/daos/app-setting/make-app-setting-dao.ts";
import { type AppSettingModel } from "@frt/db/models/app-setting-model.ts";
import { type FellowshipLogDirectory } from "@frt/shared/validation/app-settings/app-settings-schema.ts";

export type AppSettingDAOError = SqlError.SqlError | Schema.SchemaError;

type AppSettingDAOValue = {
  readonly fellowshipLogDirectory: FellowshipLogDirectory;
};

export type AppSettingDAOShape = {
  readonly get: () => E.Effect<
    Option.Option<AppSettingModel>,
    AppSettingDAOError
  >;

  readonly insert: (
    appSetting: AppSettingDAOValue,
  ) => E.Effect<void, AppSettingDAOError>;

  readonly update: (
    appSetting: AppSettingDAOValue,
  ) => E.Effect<void, AppSettingDAOError>;
};

export class AppSettingDAO extends Context.Service<
  AppSettingDAO,
  AppSettingDAOShape
>()("@frt/db/daos/app-setting/app-setting-dao/AppSettingDAO") {
  static readonly layer = Layer.effect(this, makeAppSettingDAO);
}
