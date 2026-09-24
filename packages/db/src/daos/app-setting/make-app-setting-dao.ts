import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { type AppSettingDAOShape } from "@frt/db/daos/app-setting/app-setting-dao.ts";
import { AppSettingModel } from "@frt/db/models/app-setting-model.ts";

export const makeAppSettingDAO = E.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const get: AppSettingDAOShape["get"] = () => {
    return E.gen(function* () {
      const rows = yield* sql`
        SELECT
          id,
          fellowship_log_directory,
          created_at,
          updated_at
        FROM
          app_setting
        WHERE
          id = 1
      `;

      const [appSetting] = yield* Schema.decodeUnknownEffect(
        Schema.Array(AppSettingModel),
      )(rows);

      return Option.fromUndefinedOr(appSetting);
    });
  };

  const insert: AppSettingDAOShape["insert"] = ({ fellowshipLogDirectory }) => {
    return E.gen(function* () {
      const timestamp = DateTime.toEpochMillis(yield* DateTime.now);

      yield* sql`
        INSERT INTO
          app_setting (
            id,
            fellowship_log_directory,
            created_at,
            updated_at
          )
        VALUES
          (
            1,
            ${fellowshipLogDirectory},
            ${timestamp},
            ${timestamp}
          )
      `;
    });
  };

  const update: AppSettingDAOShape["update"] = ({ fellowshipLogDirectory }) => {
    return E.gen(function* () {
      const timestamp = DateTime.toEpochMillis(yield* DateTime.now);

      yield* sql`
        UPDATE app_setting
        SET
          fellowship_log_directory = ${fellowshipLogDirectory},
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
  } satisfies AppSettingDAOShape;
});
