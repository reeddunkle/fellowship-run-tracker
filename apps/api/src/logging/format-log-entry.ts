import * as Formatter from "effect/Formatter";
import * as Logger from "effect/Logger";

import { redactUserPaths } from "@frt/api/logging/redact-user-paths.ts";

export const formatLogEntry = Logger.make((options) => {
  const span = options.fiber.currentSpan;

  return redactUserPaths(
    Formatter.formatJson({
      ...Logger.formatStructured.log(options),
      spanId: span?.spanId ?? null,
      traceId: span?.traceId ?? null,
    }),
  );
});
