import * as Schema from "effect/Schema";
import { describe, expect, test } from "vitest";

import {
  FellowshipLogsApiRateLimitExceededError,
  FellowshipLogsApiRunNotFoundError,
} from "@frt/api-contract/errors/fellowship-logs-api-error.ts";
import { FellowshipLogsFightIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { FellowshipLogsReportCodeSchema } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";

import { getMetadataErrorMessage } from "@/renderer/components/fellowship-logs/import-url-form/get-metadata-error-message.ts";

const NOW = 1_000_000;

describe("getMetadataErrorMessage", () => {
  test("says when the points reset if the lookup was over the limit", () => {
    const error = new FellowshipLogsApiRateLimitExceededError({
      resetsAtMilliseconds: NOW + 5 * 60 * 1_000,
    });

    expect(getMetadataErrorMessage(error, NOW)).toBe(
      "You're out of Fellowship Logs points. They reset in 5 minutes.",
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

  test("falls back to a general message", () => {
    expect(getMetadataErrorMessage(new Error("fetch failed"), NOW)).toBe(
      "Something went wrong contacting Fellowship Logs.",
    );
  });
});
