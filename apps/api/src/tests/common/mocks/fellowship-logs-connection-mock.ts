import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Stream from "effect/Stream";

import {
  FellowshipLogsConnection,
  type FellowshipLogsConnectionShape,
  type FellowshipLogsConnectionSummary,
} from "@frt/api/services/fellowship-logs-connection/fellowship-logs-connection-service.ts";
import { FellowshipLogsClientIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-client-credentials-schema.ts";
import {
  FELLOWSHIP_LOGS_POINT_POLICY_VERSION,
  FellowshipLogsConnectionGenerationSchema,
} from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";

const MOCK_FELLOWSHIP_LOGS_CONNECTION_SUMMARY: FellowshipLogsConnectionSummary =
  {
    clientId: FellowshipLogsClientIdSchema.make("client-id"),
    connectedUserId: null,
    connectedUserName: null,
    generation: FellowshipLogsConnectionGenerationSchema.make(
      "7c3f4a1e-2b5d-4c8e-9f60-1a2b3c4d5e6f",
    ),
    pointPolicyVersion: FELLOWSHIP_LOGS_POINT_POLICY_VERSION,
    profile: "OWN_CLIENT",
    status: "CONNECTED",
    storageProtection: "OS_BACKED",
  };

function unexpectedCall(name: string) {
  return () => {
    return E.die(`unexpected call: FellowshipLogsConnection.${name}`);
  };
}

export function makeFellowshipLogsConnectionMock(
  summary: Option.Option<FellowshipLogsConnectionSummary> = Option.some(
    MOCK_FELLOWSHIP_LOGS_CONNECTION_SUMMARY,
  ),
) {
  return Layer.succeed(FellowshipLogsConnection, {
    changes: Stream.empty,
    disconnect: unexpectedCall("disconnect"),
    getCredentials: unexpectedCall("getCredentials"),
    getSummary: () => E.succeed(summary),
    replaceTokens: unexpectedCall("replaceTokens"),
    requireReauthorization: unexpectedCall("requireReauthorization"),
    saveAuthorizedSession: unexpectedCall("saveAuthorizedSession"),
    saveOwnClient: unexpectedCall("saveOwnClient"),
    setPointSystemOptInRequired: unexpectedCall("setPointSystemOptInRequired"),
    withRequestLease: (effect) => effect,
  } satisfies FellowshipLogsConnectionShape);
}
