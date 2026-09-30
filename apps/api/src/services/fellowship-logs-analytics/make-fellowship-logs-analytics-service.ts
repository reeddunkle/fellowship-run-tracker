import * as Cause from "effect/Cause";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as E from "effect/Effect";
import * as Queue from "effect/Queue";

import { type FellowshipLogsAnalyticsShape } from "@frt/api/services/fellowship-logs-analytics/fellowship-logs-analytics-service.ts";
import {
  FellowshipLogsRequestDAO,
  type FellowshipLogsRequestEvent,
} from "@frt/db/daos/fellowship-logs-request/fellowship-logs-request-dao.ts";
import { makeRepeatedFailureLogger } from "@frt/shared/util/make-repeated-failure-logger.ts";

const MAX_BUFFERED_EVENTS = 10_000;
const MAX_BATCH_SIZE = 100;
const FLUSH_INTERVAL = Duration.seconds(2);

export const makeFellowshipLogsAnalytics = E.gen(function* () {
  const requestDAO = yield* FellowshipLogsRequestDAO;
  const events =
    yield* Queue.sliding<FellowshipLogsRequestEvent>(MAX_BUFFERED_EVENTS);

  const saveFailures = yield* makeRepeatedFailureLogger({
    level: "Warn",
    message: "Couldn't save Fellowship Logs analytics.",
  });

  const writeBatch = (batch: ReadonlyArray<FellowshipLogsRequestEvent>) => {
    return requestDAO.insertMany(batch).pipe(
      E.andThen(saveFailures.onSuccess),
      E.catch((error) => {
        return saveFailures
          .onFailure(Cause.fail(error), { eventCount: batch.length })
          .pipe(E.asVoid);
      }),
      E.uninterruptible,
    );
  };

  yield* E.addFinalizer(() => {
    return Queue.clear(events).pipe(E.flatMap(writeBatch));
  });

  const flushBufferedEvents = E.uninterruptibleMask((restore) => {
    return restore(Queue.takeBetween(events, 1, MAX_BATCH_SIZE)).pipe(
      E.tap(writeBatch),
    );
  }).pipe(
    E.flatMap((batch) => {
      return batch.length < MAX_BATCH_SIZE ? E.sleep(FLUSH_INTERVAL) : E.void;
    }),
  );

  yield* flushBufferedEvents.pipe(E.forever, E.forkScoped);

  const record: FellowshipLogsAnalyticsShape["record"] = (options) => {
    return DateTime.now.pipe(
      E.flatMap((occurredAt) => {
        return Queue.offer(events, { ...options, occurredAt });
      }),
      E.asVoid,
    );
  };

  const getSummary: FellowshipLogsAnalyticsShape["getSummary"] = () => {
    return requestDAO.getSummary().pipe(
      E.map((summary) => {
        const cacheableRequestCount =
          summary.cacheHitCount + summary.apiRequestCount;

        return {
          apiRequestCount: summary.apiRequestCount,
          cacheHitCount: summary.cacheHitCount,
          cacheHitRate:
            cacheableRequestCount === 0
              ? 0
              : summary.cacheHitCount / cacheableRequestCount,
          estimatedPointsSaved: Math.round(summary.estimatedPointsSaved),
          pointsSpent: summary.pointsSpent,
          trackingSinceMilliseconds:
            summary.trackingSince === null
              ? null
              : DateTime.toEpochMillis(summary.trackingSince),
        };
      }),
    );
  };

  return {
    getSummary,
    record,
  } satisfies FellowshipLogsAnalyticsShape;
});
