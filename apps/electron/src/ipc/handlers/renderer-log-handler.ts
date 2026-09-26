import * as Clock from "effect/Clock";
import * as E from "effect/Effect";
import * as Schema from "effect/Schema";

import {
  RendererLogEntrySchema,
  type RendererLogLevel,
} from "@frt/shared/electron-renderer/renderer-log-entry-schema.ts";

import { makeRendererLogRateLimiter } from "@/ipc/handlers/renderer-log-rate-limiter.ts";

const MAX_ENTRIES_PER_MESSAGE_PER_MINUTE = 10;

const MAX_TRACKED_MESSAGES = 500;

const RATE_LIMIT_WINDOW_MILLISECONDS = 60_000;

const LOG_BY_LEVEL = {
  Error: E.logError,
  Fatal: E.logFatal,
  Warn: E.logWarning,
} satisfies Record<RendererLogLevel, typeof E.logError>;

const decodeRendererLogEntry = Schema.decodeUnknownEffect(
  RendererLogEntrySchema,
);

export function makeRendererLogHandler() {
  const checkRateLimit = makeRendererLogRateLimiter({
    maxEntriesPerWindow: MAX_ENTRIES_PER_MESSAGE_PER_MINUTE,
    maxTrackedKeys: MAX_TRACKED_MESSAGES,
    windowMilliseconds: RATE_LIMIT_WINDOW_MILLISECONDS,
  });

  return (input: unknown) => {
    return E.gen(function* () {
      const entry = yield* decodeRendererLogEntry(input);
      const nowMilliseconds = yield* Clock.currentTimeMillis;
      const decision = checkRateLimit(entry.message, nowMilliseconds);

      if (!decision.isAllowed) {
        return;
      }

      yield* LOG_BY_LEVEL[entry.level](entry.message, {
        ...entry.annotations,
        ...(entry.cause === null ? {} : { cause: entry.cause }),
        ...(decision.suppressedCount === 0
          ? {}
          : { suppressedCount: decision.suppressedCount }),
      });
    }).pipe(
      E.annotateLogs({ process: "renderer" }),
      E.catch((cause) => {
        return E.logDebug("Ignored a malformed renderer log entry.", {
          cause,
        });
      }),
    );
  };
}
