import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/unstable/sql/SqlClient";

import { AppSettingsModel } from "@/db/models/app-settings-model.ts";

import {
  AppSettingsDAO,
  type AppSettingsDAOShape,
} from "./app-settings-dao.ts";

function decodeAppSettingsRows(
  rows: unknown,
): E.Effect<ReadonlyArray<AppSettingsModel>, Schema.SchemaError> {
  return Schema.decodeUnknownEffect(Schema.Array(AppSettingsModel))(rows);
}

const make = E.gen(function* () {
  const sql = yield* SqlClient.SqlClient;

  const get: AppSettingsDAOShape["get"] = () => {
    return E.gen(function* () {
      const rows = yield* sql`
        SELECT
          created_at AS createdAt,
          fellowship_log_directory AS fellowshipLogDirectory,
          fellowship_logs_client_id AS fellowshipLogsClientId,
          fellowship_logs_client_secret AS fellowshipLogsClientSecret,
          id,
          is_live_split_enabled AS isLiveSplitEnabled,
          live_split_host AS liveSplitHost,
          live_split_port AS liveSplitPort,
          updated_at AS updatedAt
        FROM
          app_settings
        WHERE
          id = 1
        LIMIT
          1
      `;

      const appSettingsRows = yield* decodeAppSettingsRows(rows);
      const appSettings = appSettingsRows[0];

      return appSettings === undefined
        ? Option.none<AppSettingsModel>()
        : Option.some(appSettings);
    });
  };

  const insert: AppSettingsDAOShape["insert"] = ({
    fellowshipLogDirectory,
    fellowshipLogsClientId,
    fellowshipLogsClientSecret,
    isLiveSplitEnabled,
    liveSplitHost,
    liveSplitPort,
  }) => {
    return E.gen(function* () {
      const timestamp = DateTime.toEpochMillis(yield* DateTime.now);

      yield* sql`
        INSERT INTO
          app_settings (
            id,
            live_split_host,
            live_split_port,
            is_live_split_enabled,
            fellowship_log_directory,
            fellowship_logs_client_id,
            fellowship_logs_client_secret,
            created_at,
            updated_at
          )
        VALUES
          (
            1,
            ${liveSplitHost},
            ${liveSplitPort},
            ${isLiveSplitEnabled ? 1 : 0},
            ${fellowshipLogDirectory},
            ${fellowshipLogsClientId},
            ${fellowshipLogsClientSecret},
            ${timestamp},
            ${timestamp}
          )
      `;
    });
  };

  const update: AppSettingsDAOShape["update"] = ({
    fellowshipLogDirectory,
    fellowshipLogsClientId,
    fellowshipLogsClientSecret,
    isLiveSplitEnabled,
    liveSplitHost,
    liveSplitPort,
  }) => {
    return E.gen(function* () {
      const timestamp = DateTime.toEpochMillis(yield* DateTime.now);

      yield* sql`
        UPDATE app_settings
        SET
          fellowship_log_directory = ${fellowshipLogDirectory},
          fellowship_logs_client_id = ${fellowshipLogsClientId},
          fellowship_logs_client_secret = ${fellowshipLogsClientSecret},
          is_live_split_enabled = ${isLiveSplitEnabled ? 1 : 0},
          live_split_host = ${liveSplitHost},
          live_split_port = ${liveSplitPort},
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
  } satisfies AppSettingsDAOShape;
});

export const AppSettingsDAOLive = Layer.effect(AppSettingsDAO, make);
