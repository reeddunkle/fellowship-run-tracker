import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Schema from "effect/Schema";

import { type FellowshipLogsRequestDAOShape } from "@frt/db/daos/fellowship-logs-request/fellowship-logs-request-dao.ts";
import { AnalyticsDatabase } from "@frt/db/databases/analytics-database.ts";
import { FellowshipLogsRequestDAOError } from "@frt/db/errors/fellowship-logs-request-dao-error.ts";
import { UnexpectedDatabaseError } from "@frt/db/errors/unexpected-database-error.ts";
import {
  NonNegativeIntegerSchema,
  NonNegativeNumberSchema,
} from "@frt/shared/util/common-schemas.ts";

const FellowshipLogsRequestSummaryRowSchema = Schema.Struct({
  apiRequestCount: NonNegativeIntegerSchema,
  cacheHitCount: NonNegativeIntegerSchema,
  estimatedPointsSaved: NonNegativeNumberSchema,
  pointsSpent: NonNegativeIntegerSchema,
  trackingSince: Schema.NullOr(Schema.DateTimeUtcFromMillis),
});

function mapFellowshipLogsRequestDAOError(
  cause: unknown,
): FellowshipLogsRequestDAOError {
  if (cause instanceof FellowshipLogsRequestDAOError) {
    return cause;
  }

  return new FellowshipLogsRequestDAOError({
    reason: new UnexpectedDatabaseError({ cause }),
  });
}

export const makeFellowshipLogsRequestDAO = E.gen(function* () {
  const sql = yield* AnalyticsDatabase;

  const insertMany: FellowshipLogsRequestDAOShape["insertMany"] = (events) => {
    if (events.length === 0) {
      return E.void;
    }

    const rows = events.map(
      ({ occurredAt, operation, pointsSpent, source }) => {
        return {
          occurredAt: DateTime.toEpochMillis(occurredAt),
          operation,
          pointsSpent,
          source,
        };
      },
    );

    return sql`
      INSERT INTO
        fellowship_logs_request ${sql.insert(rows)}
    `.pipe(E.asVoid, E.mapError(mapFellowshipLogsRequestDAOError));
  };

  const getSummary: FellowshipLogsRequestDAOShape["getSummary"] = () => {
    return E.gen(function* () {
      const [row] = yield* sql`
        WITH
          operation_cost AS (
            SELECT
              operation,
              AVG(points_spent) AS average_points_spent
            FROM
              fellowship_logs_request
            WHERE
              source = 'API'
              AND points_spent IS NOT NULL
            GROUP BY
              operation
          )
        SELECT
          COUNT(*) FILTER (
            WHERE
              request.source = 'API'
              AND request.operation != 'RATE_LIMIT_DATA'
          ) AS api_request_count,
          COUNT(*) FILTER (
            WHERE
              request.source = 'CACHE'
          ) AS cache_hit_count,
          COALESCE(
            SUM(
              CASE
                WHEN request.source = 'CACHE' THEN operation_cost.average_points_spent
              END
            ),
            0.0
          ) AS estimated_points_saved,
          COALESCE(SUM(request.points_spent), 0) AS points_spent,
          MIN(request.occurred_at) AS tracking_since
        FROM
          fellowship_logs_request AS request
          LEFT JOIN operation_cost USING (operation)
      `;

      return yield* Schema.decodeUnknownEffect(
        FellowshipLogsRequestSummaryRowSchema,
      )(row);
    }).pipe(E.mapError(mapFellowshipLogsRequestDAOError));
  };

  return {
    getSummary,
    insertMany,
  } satisfies FellowshipLogsRequestDAOShape;
});
