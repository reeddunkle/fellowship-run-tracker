import * as Context from "effect/Context";
import type * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as Option from "effect/Option";
import type * as Schema from "effect/Schema";
import type * as SqlError from "effect/unstable/sql/SqlError";

import { makeLiveSplitSettingDAO } from "@frt/db/daos/live-split-setting/make-live-split-setting-dao.ts";
import { type LiveSplitSettingModel } from "@frt/db/models/live-split-setting-model.ts";
import {
  type LiveSplitHost,
  type LiveSplitPort,
} from "@frt/shared/app-settings/app-settings-schema.ts";

export type LiveSplitSettingDAOError = SqlError.SqlError | Schema.SchemaError;

type LiveSplitSettingDAOValue = {
  readonly host: LiveSplitHost;
  readonly isEnabled: boolean;
  readonly port: LiveSplitPort;
};

export type LiveSplitSettingDAOShape = {
  readonly get: () => E.Effect<
    Option.Option<LiveSplitSettingModel>,
    LiveSplitSettingDAOError
  >;

  readonly insert: (
    liveSplitSetting: LiveSplitSettingDAOValue,
  ) => E.Effect<void, LiveSplitSettingDAOError>;

  readonly update: (
    liveSplitSetting: LiveSplitSettingDAOValue,
  ) => E.Effect<void, LiveSplitSettingDAOError>;
};

export class LiveSplitSettingDAO extends Context.Service<
  LiveSplitSettingDAO,
  LiveSplitSettingDAOShape
>()(
  "@frt/db/daos/live-split-setting/live-split-setting-dao/LiveSplitSettingDAO",
) {
  static readonly layer = Layer.effect(this, makeLiveSplitSettingDAO);
}
