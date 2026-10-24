import {
  type FellowshipLogsConnectionProfile,
  type FellowshipLogsSpending,
} from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";

export type FellowshipLogsGatewayEndpoint = "CLIENT" | "USER";

export type FellowshipLogsGatewaySpending = FellowshipLogsSpending;

export type FellowshipLogsGatewayRequestContext = {
  readonly connectionIdentity: string | null;
  readonly spending: FellowshipLogsGatewaySpending;
};

export const DEFAULT_FELLOWSHIP_LOGS_GATEWAY_REQUEST_CONTEXT = {
  connectionIdentity: null,
  spending: "DEFAULT",
} as const satisfies FellowshipLogsGatewayRequestContext;

export type FellowshipLogsGatewayRequestPolicy = {
  readonly endpoint: FellowshipLogsGatewayEndpoint;
  readonly spending: FellowshipLogsGatewaySpending;
};

export const FELLOWSHIP_LOGS_GATEWAY_ENDPOINT_URLS = {
  CLIENT: "https://www.fellowshiplogs.com/api/v2/client",
  USER: "https://www.fellowshiplogs.com/api/v2/user",
} as const satisfies Record<FellowshipLogsGatewayEndpoint, string>;

const REQUEST_POLICIES = {
  FELLOWSHIP_RUN_TRACKER_USER: {
    endpoint: "USER",
    spending: "USER_POINTS_ONLY",
  },
  OWN_CLIENT: {
    endpoint: "CLIENT",
    spending: "DEFAULT",
  },
  OWN_CLIENT_USER: {
    endpoint: "USER",
    spending: "DEFAULT",
  },
} as const satisfies Record<
  FellowshipLogsConnectionProfile,
  FellowshipLogsGatewayRequestPolicy
>;

export function getFellowshipLogsGatewayRequestPolicy(
  profile: FellowshipLogsConnectionProfile,
): FellowshipLogsGatewayRequestPolicy {
  return REQUEST_POLICIES[profile];
}
