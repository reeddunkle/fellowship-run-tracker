import { describe, expect, test } from "vitest";

import { getImportJobFailureMessage } from "@/renderer/components/background-jobs/get-import-job-failure-message.ts";

describe("getImportJobFailureMessage", () => {
  test("explains running out of Fellowship Logs points", () => {
    expect(
      getImportJobFailureMessage({
        message: "Out of points.",
        tag: "FellowshipLogsRateLimitExceededError",
      }),
    ).toBe("Ran out of Fellowship Logs points before the import finished.");
  });

  test("falls back to a general message for unknown failures", () => {
    expect(
      getImportJobFailureMessage({ message: "Boom.", tag: "SomethingElse" }),
    ).toBe("Something went wrong importing this run.");
  });
});
