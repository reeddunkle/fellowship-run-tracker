import * as E from "effect/Effect";

import { FellowshipLogsGatewayRequestError } from "@frt/api/errors/fellowship-logs-gateway-error.ts";
import {
  type FellowshipLogsGatewayFilteredReport,
  type FellowshipLogsGatewayReport,
} from "@frt/api/services/fellowship-logs-gateway/validation/fellowship-logs-gateway-report-schema.ts";

function getEventTimestamp(event: unknown) {
  if (
    typeof event === "object" &&
    event !== null &&
    "timestamp" in event &&
    typeof event.timestamp === "number"
  ) {
    return event.timestamp;
  }

  return 0;
}

export function normalizeFellowshipLogsGatewayReport(
  report: FellowshipLogsGatewayFilteredReport | FellowshipLogsGatewayReport,
) {
  if ("events" in report) {
    return E.succeed(report);
  }

  const eventFields = [
    report.dungeonStarts,
    report.dungeonEnds,
    report.encounterStarts,
    report.encounterEnds,
    report.casts,
    report.deaths,
  ];
  const nextPageTimestamp = report.dungeonStarts.nextPageTimestamp;
  const cursorsMatch = eventFields.every((events) => {
    return events.nextPageTimestamp === nextPageTimestamp;
  });

  if (!cursorsMatch) {
    return E.fail(
      new FellowshipLogsGatewayRequestError({
        cause: new Error(
          "Fellowship Logs returned different cursors for filtered event fields.",
        ),
        operation: "Query",
      }),
    );
  }

  const data = eventFields
    .flatMap((events) => {
      return events.data;
    })
    .toSorted((left, right) => {
      return getEventTimestamp(left) - getEventTimestamp(right);
    });

  return E.succeed({
    ...report,
    events: {
      data,
      nextPageTimestamp,
    },
  } satisfies FellowshipLogsGatewayReport);
}
