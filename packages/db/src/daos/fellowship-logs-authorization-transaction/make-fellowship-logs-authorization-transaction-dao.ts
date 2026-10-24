import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { type FellowshipLogsAuthorizationTransactionDAOShape } from "@frt/db/daos/fellowship-logs-authorization-transaction/fellowship-logs-authorization-transaction-dao.ts";
import { MainDatabase } from "@frt/db/databases/main-database.ts";
import { FellowshipLogsAuthorizationTransactionModel } from "@frt/db/models/fellowship-logs-authorization-transaction-model.ts";

export const makeFellowshipLogsAuthorizationTransactionDAO = E.gen(
  function* () {
    const sql = yield* MainDatabase;

    const get: FellowshipLogsAuthorizationTransactionDAOShape["get"] = E.fn(
      "FellowshipLogsAuthorizationTransactionDAO.get",
    )(function* () {
      const rows = yield* sql`
        SELECT
          id,
          profile,
          client_id,
          redirect_uri,
          state,
          protected_verifier,
          expected_generation,
          created_at,
          expires_at
        FROM
          fellowship_logs_authorization_transaction
        WHERE
          id = 1
      `;

      const [transaction] = yield* Schema.decodeUnknownEffect(
        Schema.Array(FellowshipLogsAuthorizationTransactionModel),
      )(rows);

      return Option.fromUndefinedOr(transaction);
    });

    const replace: FellowshipLogsAuthorizationTransactionDAOShape["replace"] =
      E.fn("FellowshipLogsAuthorizationTransactionDAO.replace")(
        function* (transaction) {
          const createdAt = DateTime.toEpochMillis(transaction.createdAt);
          const expiresAt = DateTime.toEpochMillis(transaction.expiresAt);

          yield* sql.withTransaction(
            E.gen(function* () {
              yield* sql`DELETE FROM fellowship_logs_authorization_transaction`;

              yield* sql`
                INSERT INTO
                  fellowship_logs_authorization_transaction (
                    id,
                    profile,
                    client_id,
                    redirect_uri,
                    state,
                    protected_verifier,
                    expected_generation,
                    created_at,
                    expires_at
                  )
                VALUES
                  (
                    1,
                    ${transaction.profile},
                    ${transaction.clientId},
                    ${transaction.redirectUri},
                    ${transaction.state},
                    ${transaction.protectedVerifier},
                    ${transaction.expectedGeneration},
                    ${createdAt},
                    ${expiresAt}
                  )
              `;
            }),
          );
        },
      );

    const deleteTransaction: FellowshipLogsAuthorizationTransactionDAOShape["delete"] =
      E.fn("FellowshipLogsAuthorizationTransactionDAO.delete")(function* () {
        yield* sql`DELETE FROM fellowship_logs_authorization_transaction`;
      });

    const deleteExpired: FellowshipLogsAuthorizationTransactionDAOShape["deleteExpired"] =
      E.fn("FellowshipLogsAuthorizationTransactionDAO.deleteExpired")(
        function* (now) {
          yield* sql`
            DELETE FROM fellowship_logs_authorization_transaction
            WHERE
              expires_at <= ${DateTime.toEpochMillis(now)}
          `;
        },
      );

    return {
      delete: deleteTransaction,
      deleteExpired,
      get,
      replace,
    } satisfies FellowshipLogsAuthorizationTransactionDAOShape;
  },
);
