import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Option from "effect/Option";

import { type FellowshipLogsResponseOperation } from "@frt/db/validation/fellowship-logs-response/fellowship-logs-response-operation-schema.ts";

export const FELLOWSHIP_LOGS_GATEWAY_CACHE_MAX_BYTES = 1024 ** 3;

const RECENT_REPORT_AGE = Duration.hours(2);

const RECENT_REPORT_TIME_TO_LIVE = Duration.minutes(5);

export function makeFellowshipLogsGatewayResponseKey(
  operation: FellowshipLogsResponseOperation,
  parts: ReadonlyArray<number | string>,
): string {
  return [operation, ...parts].join(":");
}

type FightResponseData = {
  readonly reportData: {
    readonly report: {
      readonly endTime: number;
      readonly fights: ReadonlyArray<{
        readonly id: number;
        readonly inProgress: boolean;
      }>;
    } | null;
  };
};

type GetFightResponseExpiresAtOptions = {
  readonly data: FightResponseData;
  readonly fightId: number;
  readonly now: DateTime.Utc;
};

export function getFightResponseExpiresAt({
  data,
  fightId,
  now,
}: GetFightResponseExpiresAtOptions): Option.Option<DateTime.Utc | null> {
  const { report } = data.reportData;

  const fight = report?.fights.find((candidate) => {
    return candidate.id === fightId;
  });

  if (report === null || fight === undefined) {
    return Option.none();
  }

  const reportAgeMilliseconds = DateTime.toEpochMillis(now) - report.endTime;

  const isRecent = reportAgeMilliseconds < Duration.toMillis(RECENT_REPORT_AGE);

  return Option.some(
    fight.inProgress || isRecent
      ? DateTime.addDuration(now, RECENT_REPORT_TIME_TO_LIVE)
      : null,
  );
}

type ReportPageResponseData = {
  readonly reportData: {
    readonly report: unknown;
  };
};

export function getReportPageResponseExpiresAt(
  data: ReportPageResponseData,
): Option.Option<DateTime.Utc | null> {
  return data.reportData.report === null ? Option.none() : Option.some(null);
}
