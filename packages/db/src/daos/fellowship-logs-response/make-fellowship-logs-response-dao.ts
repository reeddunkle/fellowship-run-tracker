import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { type FellowshipLogsResponseDAOShape } from "@frt/db/daos/fellowship-logs-response/fellowship-logs-response-dao.ts";
import { FellowshipLogsCacheDatabase } from "@frt/db/databases/fellowship-logs-cache-database.ts";
import { FellowshipLogsResponseDAOError } from "@frt/db/errors/fellowship-logs-response-dao-error.ts";
import { UnexpectedDatabaseError } from "@frt/db/errors/unexpected-database-error.ts";
import { FellowshipLogsResponseModel } from "@frt/db/models/fellowship-logs-response-model.ts";

function mapFellowshipLogsResponseDAOError(
  cause: unknown,
): FellowshipLogsResponseDAOError {
  if (cause instanceof FellowshipLogsResponseDAOError) {
    return cause;
  }

  return new FellowshipLogsResponseDAOError({
    reason: new UnexpectedDatabaseError({ cause }),
  });
}

const nowMillis = DateTime.now.pipe(E.map(DateTime.toEpochMillis));

export const makeFellowshipLogsResponseDAO = E.gen(function* () {
  const sql = yield* FellowshipLogsCacheDatabase;

  const get: FellowshipLogsResponseDAOShape["get"] = ({ key }) => {
    return E.gen(function* () {
      const now = yield* nowMillis;

      const rows = yield* sql`
        SELECT
          request_key,
          operation,
          report_code,
          fight_id,
          report_revision,
          body,
          byte_size,
          expires_at,
          created_at,
          last_accessed_at
        FROM
          fellowship_logs_response
        WHERE
          request_key = ${key}
          AND (
            expires_at IS NULL
            OR expires_at > ${now}
          )
      `;

      const [response] = yield* Schema.decodeUnknownEffect(
        Schema.Array(FellowshipLogsResponseModel),
      )(rows);

      return Option.fromUndefinedOr(response);
    }).pipe(E.mapError(mapFellowshipLogsResponseDAOError));
  };

  const put: FellowshipLogsResponseDAOShape["put"] = ({
    body,
    expiresAt,
    fightId,
    key,
    operation,
    reportCode,
    reportRevision,
  }) => {
    return E.gen(function* () {
      const now = yield* nowMillis;
      const encodedExpiresAt =
        expiresAt === null ? null : DateTime.toEpochMillis(expiresAt);

      yield* sql`
        INSERT INTO
          fellowship_logs_response (
            request_key,
            operation,
            report_code,
            fight_id,
            report_revision,
            body,
            byte_size,
            expires_at,
            created_at,
            last_accessed_at
          )
        VALUES
          (
            ${key},
            ${operation},
            ${reportCode},
            ${fightId},
            ${reportRevision},
            ${body},
            ${body.byteLength},
            ${encodedExpiresAt},
            ${now},
            ${now}
          )
        ON CONFLICT (request_key) DO UPDATE
        SET
          operation = excluded.operation,
          report_code = excluded.report_code,
          fight_id = excluded.fight_id,
          report_revision = excluded.report_revision,
          body = excluded.body,
          byte_size = excluded.byte_size,
          expires_at = excluded.expires_at,
          created_at = excluded.created_at,
          last_accessed_at = excluded.last_accessed_at
      `;
    }).pipe(E.mapError(mapFellowshipLogsResponseDAOError));
  };

  const touch: FellowshipLogsResponseDAOShape["touch"] = ({ key }) => {
    return E.gen(function* () {
      const now = yield* nowMillis;

      yield* sql`
        UPDATE fellowship_logs_response
        SET
          last_accessed_at = ${now}
        WHERE
          request_key = ${key}
      `;
    }).pipe(E.mapError(mapFellowshipLogsResponseDAOError));
  };

  const delete_: FellowshipLogsResponseDAOShape["delete"] = ({ key }) => {
    return sql`
      DELETE FROM fellowship_logs_response
      WHERE
        request_key = ${key}
    `.pipe(E.asVoid, E.mapError(mapFellowshipLogsResponseDAOError));
  };

  const deleteForReport: FellowshipLogsResponseDAOShape["deleteForReport"] = ({
    reportCode,
  }) => {
    return sql`
      DELETE FROM fellowship_logs_response
      WHERE
        report_code = ${reportCode}
      RETURNING
        request_key
    `.pipe(
      E.map((rows) => {
        return rows.length;
      }),
      E.mapError(mapFellowshipLogsResponseDAOError),
    );
  };

  const deleteExpired: FellowshipLogsResponseDAOShape["deleteExpired"] = () => {
    return E.gen(function* () {
      const now = yield* nowMillis;

      const rows = yield* sql`
        DELETE FROM fellowship_logs_response
        WHERE
          expires_at IS NOT NULL
          AND expires_at <= ${now}
        RETURNING
          request_key
      `;

      return rows.length;
    }).pipe(E.mapError(mapFellowshipLogsResponseDAOError));
  };

  const evictToSize: FellowshipLogsResponseDAOShape["evictToSize"] = ({
    maxBytes,
  }) => {
    return sql`
      DELETE FROM fellowship_logs_response
      WHERE
        request_key IN (
          SELECT
            request_key
          FROM
            (
              SELECT
                request_key,
                SUM(byte_size) OVER (
                  ORDER BY
                    last_accessed_at DESC,
                    request_key DESC
                ) AS running_byte_size
              FROM
                fellowship_logs_response
            )
          WHERE
            running_byte_size > ${maxBytes}
        )
      RETURNING
        request_key
    `.pipe(
      E.map((rows) => {
        return rows.length;
      }),
      E.mapError(mapFellowshipLogsResponseDAOError),
    );
  };

  const incrementalVacuum: FellowshipLogsResponseDAOShape["incrementalVacuum"] =
    () => {
      return sql`PRAGMA incremental_vacuum`.pipe(
        E.asVoid,
        E.mapError(mapFellowshipLogsResponseDAOError),
      );
    };

  return {
    delete: delete_,
    deleteExpired,
    deleteForReport,
    evictToSize,
    get,
    incrementalVacuum,
    put,
    touch,
  } satisfies FellowshipLogsResponseDAOShape;
});
