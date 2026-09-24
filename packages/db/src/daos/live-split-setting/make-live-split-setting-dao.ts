import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { type LiveSplitSettingDAOShape } from "@frt/db/daos/live-split-setting/live-split-setting-dao.ts";
import { LiveSplitSettingModel } from "@frt/db/models/live-split-setting-model.ts";

export const makeLiveSplitSettingDAO = E.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const get: LiveSplitSettingDAOShape["get"] = () => {
    return E.gen(function* () {
      const rows = yield* sql`
        SELECT
          id,
          host,
          port,
          is_enabled,
          created_at,
          updated_at
        FROM
          live_split_setting
        WHERE
          id = 1
      `;

      const [liveSplitSetting] = yield* Schema.decodeUnknownEffect(
        Schema.Array(LiveSplitSettingModel),
      )(rows);

      return Option.fromUndefinedOr(liveSplitSetting);
    });
  };

  const insert: LiveSplitSettingDAOShape["insert"] = ({
    host,
    isEnabled,
    port,
  }) => {
    return E.gen(function* () {
      const timestamp = DateTime.toEpochMillis(yield* DateTime.now);

      yield* sql`
        INSERT INTO
          live_split_setting (
            id,
            host,
            port,
            is_enabled,
            created_at,
            updated_at
          )
        VALUES
          (
            1,
            ${host},
            ${port},
            ${isEnabled ? 1 : 0},
            ${timestamp},
            ${timestamp}
          )
      `;
    });
  };

  const update: LiveSplitSettingDAOShape["update"] = ({
    host,
    isEnabled,
    port,
  }) => {
    return E.gen(function* () {
      const timestamp = DateTime.toEpochMillis(yield* DateTime.now);

      yield* sql`
        UPDATE live_split_setting
        SET
          host = ${host},
          port = ${port},
          is_enabled = ${isEnabled ? 1 : 0},
          updated_at = ${timestamp}
        WHERE
          id = 1
      `;
    });
  };

  return {
    get,
    insert,
    update,
  } satisfies LiveSplitSettingDAOShape;
});
