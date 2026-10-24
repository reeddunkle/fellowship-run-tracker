import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { type FellowshipLogsConnectionDAOShape } from "@frt/db/daos/fellowship-logs-connection/fellowship-logs-connection-dao.ts";
import { MainDatabase } from "@frt/db/databases/main-database.ts";
import { FellowshipLogsConnectionModel } from "@frt/db/models/fellowship-logs-connection-model.ts";

export const makeFellowshipLogsConnectionDAO = E.gen(function* () {
  const sql = yield* MainDatabase;

  const get: FellowshipLogsConnectionDAOShape["get"] = E.fn(
    "FellowshipLogsConnectionDAO.get",
  )(function* () {
    const rows = yield* sql`
      SELECT
        id,
        profile,
        client_id,
        client_secret,
        access_token,
        access_token_expires_at,
        refresh_token,
        connected_user_id,
        connected_user_name,
        generation,
        point_policy_version,
        point_system_opt_in_required_at,
        storage_protection,
        local_protection_acknowledged_at,
        created_at,
        updated_at
      FROM
        fellowship_logs_connection
      WHERE
        id = 1
    `;

    const [connection] = yield* Schema.decodeUnknownEffect(
      Schema.Array(FellowshipLogsConnectionModel),
    )(rows);

    return Option.fromUndefinedOr(connection);
  });

  const save: FellowshipLogsConnectionDAOShape["save"] = E.fn(
    "FellowshipLogsConnectionDAO.save",
  )(function* (connection) {
    const timestamp = DateTime.toEpochMillis(yield* DateTime.now);
    const accessTokenExpiresAt =
      connection.accessTokenExpiresAt === null
        ? null
        : DateTime.toEpochMillis(connection.accessTokenExpiresAt);
    const localProtectionAcknowledgedAt =
      connection.localProtectionAcknowledgedAt === null
        ? null
        : DateTime.toEpochMillis(connection.localProtectionAcknowledgedAt);
    const pointSystemOptInRequiredAt =
      connection.pointSystemOptInRequiredAt === null
        ? null
        : DateTime.toEpochMillis(connection.pointSystemOptInRequiredAt);

    yield* sql`
      INSERT INTO
        fellowship_logs_connection (
          id,
          profile,
          client_id,
          client_secret,
          access_token,
          access_token_expires_at,
          refresh_token,
          connected_user_id,
          connected_user_name,
          generation,
          point_policy_version,
          point_system_opt_in_required_at,
          storage_protection,
          local_protection_acknowledged_at,
          created_at,
          updated_at
        )
      VALUES
        (
          1,
          ${connection.profile},
          ${connection.clientId},
          ${connection.clientSecret},
          ${connection.accessToken},
          ${accessTokenExpiresAt},
          ${connection.refreshToken},
          ${connection.connectedUserId},
          ${connection.connectedUserName},
          ${connection.generation},
          ${connection.pointPolicyVersion},
          ${pointSystemOptInRequiredAt},
          ${connection.storageProtection},
          ${localProtectionAcknowledgedAt},
          ${timestamp},
          ${timestamp}
        )
      ON CONFLICT (id) DO UPDATE
      SET
        profile = excluded.profile,
        client_id = excluded.client_id,
        client_secret = excluded.client_secret,
        access_token = excluded.access_token,
        access_token_expires_at = excluded.access_token_expires_at,
        refresh_token = excluded.refresh_token,
        connected_user_id = excluded.connected_user_id,
        connected_user_name = excluded.connected_user_name,
        generation = excluded.generation,
        point_policy_version = excluded.point_policy_version,
        point_system_opt_in_required_at = excluded.point_system_opt_in_required_at,
        storage_protection = excluded.storage_protection,
        local_protection_acknowledged_at = excluded.local_protection_acknowledged_at,
        updated_at = excluded.updated_at
    `;
  });

  const deleteConnection: FellowshipLogsConnectionDAOShape["delete"] = E.fn(
    "FellowshipLogsConnectionDAO.delete",
  )(function* () {
    yield* sql`
      DELETE FROM fellowship_logs_connection
      WHERE
        id = 1
    `;
  });

  return {
    delete: deleteConnection,
    get,
    save,
  } satisfies FellowshipLogsConnectionDAOShape;
});
