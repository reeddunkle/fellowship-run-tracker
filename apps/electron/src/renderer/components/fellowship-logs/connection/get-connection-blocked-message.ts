import { type FellowshipLogsApiConnectionStatus } from "@frt/shared/fellowship-logs/fellowship-logs-connection-api-schema.ts";

const CONNECTION_BLOCKED_MESSAGES = {
  CONNECTED: undefined,
  POINT_SYSTEM_OPT_IN_REQUIRED:
    "Opt into the Fellowship Logs point system above to import runs.",
  REAUTHORIZATION_REQUIRED:
    "Sign in to Fellowship Logs again above to import runs.",
} as const satisfies Record<
  NonNullable<FellowshipLogsApiConnectionStatus["connection"]>["status"],
  string | undefined
>;

export function getConnectionBlockedMessage(
  status: FellowshipLogsApiConnectionStatus | undefined,
): string | undefined {
  if (status === undefined) {
    return undefined;
  }

  if (status.connection === null) {
    return "Connect to Fellowship Logs above to import runs.";
  }

  return CONNECTION_BLOCKED_MESSAGES[status.connection.status];
}
