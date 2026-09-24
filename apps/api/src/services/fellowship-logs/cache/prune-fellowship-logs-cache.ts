import * as E from "effect/Effect";

import { FELLOWSHIP_LOGS_CACHE_MAX_BYTES } from "@frt/api/services/fellowship-logs/cache/fellowship-logs-cache-policy.ts";
import { FellowshipLogsResponseDAO } from "@frt/db/daos/fellowship-logs-response/fellowship-logs-response-dao.ts";

export const pruneFellowshipLogsCache = E.gen(function* () {
  const responseDAO = yield* FellowshipLogsResponseDAO;

  const expiredCount = yield* responseDAO.deleteExpired();

  const evictedCount = yield* responseDAO.evictToSize({
    maxBytes: FELLOWSHIP_LOGS_CACHE_MAX_BYTES,
  });

  yield* responseDAO.incrementalVacuum();

  if (expiredCount > 0 || evictedCount > 0) {
    yield* E.logInfo("Pruned the Fellowship Logs cache.", {
      evictedCount,
      expiredCount,
    });
  }

  return { evictedCount, expiredCount };
});
