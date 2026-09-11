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
          id,
          live_splits_host AS liveSplitsHost,
          live_splits_port AS liveSplitsPort,
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
    liveSplitsHost,
    liveSplitsPort,
  }) => {
    return E.gen(function* () {
      const timestamp = DateTime.toEpochMillis(yield* DateTime.now);

      yield* sql`
        INSERT INTO
          app_settings (
            id,
            live_splits_host,
            live_splits_port,
            fellowship_log_directory,
            created_at,
            updated_at
          )
        VALUES
          (
            1,
            ${liveSplitsHost},
            ${liveSplitsPort},
            ${fellowshipLogDirectory},
            ${timestamp},
            ${timestamp}
          )
      `;
    });
  };

  const update: AppSettingsDAOShape["update"] = ({
    fellowshipLogDirectory,
    liveSplitsHost,
    liveSplitsPort,
  }) => {
    return E.gen(function* () {
      const timestamp = DateTime.toEpochMillis(yield* DateTime.now);

      yield* sql`
        UPDATE app_settings
        SET
          fellowship_log_directory = ${fellowshipLogDirectory},
          live_splits_host = ${liveSplitsHost},
          live_splits_port = ${liveSplitsPort},
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
