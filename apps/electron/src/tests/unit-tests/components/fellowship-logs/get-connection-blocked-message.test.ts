import { describe, expect, test } from "vitest";

import { type FellowshipLogsApiConnectionStatus } from "@frt/shared/fellowship-logs/fellowship-logs-connection-api-schema.ts";
import {
  FELLOWSHIP_LOGS_POINT_POLICY_VERSION,
  FellowshipLogsConnectionGenerationSchema,
} from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";

import { getConnectionBlockedMessage } from "@/renderer/components/fellowship-logs/connection/get-connection-blocked-message.ts";

function withStatus(
  status: NonNullable<
    FellowshipLogsApiConnectionStatus["connection"]
  >["status"],
): FellowshipLogsApiConnectionStatus {
  return {
    authorization: { state: "IDLE" },
    connection: {
      clientId: null,
      connectedUserName: null,
      generation: FellowshipLogsConnectionGenerationSchema.make(
        "7c3f4a1e-2b5d-4c8e-9f60-1a2b3c4d5e6f",
      ),
      pointPolicyVersion: FELLOWSHIP_LOGS_POINT_POLICY_VERSION,
      profile: "FELLOWSHIP_RUN_TRACKER_USER",
      spending: "USER_POINTS_ONLY",
      status,
      storageProtection: "OS_BACKED",
    },
  };
}

describe("getConnectionBlockedMessage", () => {
  test("allows imports only with a usable connection", () => {
    expect(getConnectionBlockedMessage(undefined)).toBeUndefined();
    expect(
      getConnectionBlockedMessage(withStatus("CONNECTED")),
    ).toBeUndefined();
    expect(
      getConnectionBlockedMessage({
        authorization: { state: "IDLE" },
        connection: null,
      }),
    ).toBe("Connect to Fellowship Logs above to import runs.");
    expect(
      getConnectionBlockedMessage(withStatus("REAUTHORIZATION_REQUIRED")),
    ).toBe("Sign in to Fellowship Logs again above to import runs.");
    expect(
      getConnectionBlockedMessage(withStatus("POINT_SYSTEM_OPT_IN_REQUIRED")),
    ).toBe("Opt into the Fellowship Logs point system above to import runs.");
  });
});
