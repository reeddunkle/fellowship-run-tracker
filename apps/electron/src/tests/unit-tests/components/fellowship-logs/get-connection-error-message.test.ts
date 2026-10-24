import { describe, expect, test } from "vitest";

import { FellowshipLogsApiInvalidCredentialsError } from "@frt/api-contract/errors/fellowship-logs-api-error.ts";

import { getConnectionErrorMessage } from "@/renderer/components/fellowship-logs/connection/get-connection-error-message.ts";

const MARKER_SECRET = "marker-renderer-secret-8e2dcac1";

describe("getConnectionErrorMessage", () => {
  test("does not display details from unexpected errors", () => {
    const message = getConnectionErrorMessage(
      new Error(`provider response contained ${MARKER_SECRET}`),
    );

    expect(message).toBe("Something went wrong. Try again.");
    expect(message).not.toContain(MARKER_SECRET);
  });

  test("displays messages from the safe API error contract", () => {
    expect(
      getConnectionErrorMessage(new FellowshipLogsApiInvalidCredentialsError()),
    ).toBe("Fellowship Logs didn't accept that client ID and secret.");
  });
});
