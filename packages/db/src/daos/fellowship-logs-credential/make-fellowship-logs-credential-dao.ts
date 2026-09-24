import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { type FellowshipLogsCredentialDAOShape } from "@frt/db/daos/fellowship-logs-credential/fellowship-logs-credential-dao.ts";
import { MainDatabase } from "@frt/db/databases/main-database.ts";
import { FellowshipLogsCredentialModel } from "@frt/db/models/fellowship-logs-credential-model.ts";

export const makeFellowshipLogsCredentialDAO = E.gen(function* () {
  const sql = yield* MainDatabase;

  const get: FellowshipLogsCredentialDAOShape["get"] = () => {
    return E.gen(function* () {
      const rows = yield* sql`
        SELECT
          id,
          client_id,
          client_secret,
          created_at,
          updated_at
        FROM
          fellowship_logs_credential
        WHERE
          id = 1
      `;

      const [credential] = yield* Schema.decodeUnknownEffect(
        Schema.Array(FellowshipLogsCredentialModel),
      )(rows);

      return Option.fromUndefinedOr(credential);
    });
  };

  const insert: FellowshipLogsCredentialDAOShape["insert"] = ({
    clientId,
    clientSecret,
  }) => {
    return E.gen(function* () {
      const timestamp = DateTime.toEpochMillis(yield* DateTime.now);

      yield* sql`
        INSERT INTO
          fellowship_logs_credential (
            id,
            client_id,
            client_secret,
            created_at,
            updated_at
          )
        VALUES
          (
            1,
            ${clientId},
            ${clientSecret},
            ${timestamp},
            ${timestamp}
          )
      `;
    });
  };

  const update: FellowshipLogsCredentialDAOShape["update"] = ({
    clientId,
    clientSecret,
  }) => {
    return E.gen(function* () {
      const timestamp = DateTime.toEpochMillis(yield* DateTime.now);

      yield* sql`
        UPDATE fellowship_logs_credential
        SET
          client_id = ${clientId},
          client_secret = ${clientSecret},
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
  } satisfies FellowshipLogsCredentialDAOShape;
});
