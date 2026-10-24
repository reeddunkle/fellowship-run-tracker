import * as Schema from "effect/Schema";
import { describe, expect, test } from "vitest";

import {
  FellowshipLogsApiRateLimitExceededError,
  FellowshipLogsApiReportAccessDeniedError,
  FellowshipLogsApiRunNotFoundError,
} from "@frt/api-contract/errors/fellowship-logs-api-error.ts";
import { FellowshipLogsFightIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { FellowshipLogsReportCodeSchema } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";

import { getMetadataErrorMessage } from "@/renderer/components/fellowship-logs/import-url-form/get-metadata-error-message.ts";
import { formatLocalTimeFromMilliseconds } from "@/util/format-date-time.ts";

const NOW = 1_000_000;

describe("getMetadataErrorMessage", () => {
  test("names the empty pool and when it resets if the lookup was over the limit", () => {
    const resetsAtMilliseconds = NOW + 5 * 60 * 1_000;
    const error = new FellowshipLogsApiRateLimitExceededError({
      reason: "USER_POINTS_EXHAUSTED",
      resetsAtMilliseconds,
    });

    expect(getMetadataErrorMessage(error, NOW)).toBe(
      `You're out of your account points. Points reset in 5 minutes, at ${formatLocalTimeFromMilliseconds(resetsAtMilliseconds)}.`,
    );
  });

  test("explains a run that wasn't found", () => {
    const error = new FellowshipLogsApiRunNotFoundError({
      fightId: Schema.decodeSync(FellowshipLogsFightIdSchema)(15),
      reportCode: Schema.decodeSync(FellowshipLogsReportCodeSchema)(
        "XdfFZzgHBJNr6m3v",
      ),
    });

    expect(getMetadataErrorMessage(error, NOW)).toBe(
      "We couldn't find that report and fight. Double-check the URL.",
    );
  });

  test("explains when the connection cannot view a report", () => {
    const error = new FellowshipLogsApiReportAccessDeniedError({
      fightId: Schema.decodeSync(FellowshipLogsFightIdSchema)(15),
      reportCode: Schema.decodeSync(FellowshipLogsReportCodeSchema)(
        "XdfFZzgHBJNr6m3v",
      ),
    });

    expect(getMetadataErrorMessage(error, NOW)).toBe(
      "This connection doesn't have permission to view that report. Use a connection with access, or choose a public report.",
    );
  });

  test("falls back to a general message", () => {
    expect(getMetadataErrorMessage(new Error("fetch failed"), NOW)).toBe(
      "Something went wrong contacting Fellowship Logs.",
    );
  });
});
