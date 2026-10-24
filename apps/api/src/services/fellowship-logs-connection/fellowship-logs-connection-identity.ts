import * as Context from "effect/Context";
import * as E from "effect/Effect";

import { type FellowshipLogsClientId } from "@frt/shared/fellowship-logs/fellowship-logs-client-credentials-schema.ts";
import {
  type FellowshipLogsConnectedUserId,
  type FellowshipLogsConnectionProfile,
} from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";

type FellowshipLogsConnectionIdentityParts = {
  readonly clientId: FellowshipLogsClientId;
  readonly connectedUserId?: FellowshipLogsConnectedUserId | null;
  readonly profile: FellowshipLogsConnectionProfile;
};

export function getFellowshipLogsConnectionIdentity({
  clientId,
  connectedUserId = null,
  profile,
}: FellowshipLogsConnectionIdentityParts): string {
  return JSON.stringify([profile, clientId, connectedUserId]);
}

export const ExpectedFellowshipLogsConnectionIdentity = Context.Reference<
  string | null
>(
  "@frt/api/services/fellowship-logs-connection/fellowship-logs-connection-identity/ExpectedFellowshipLogsConnectionIdentity",
  {
    defaultValue: () => {
      return null;
    },
  },
);

export function withExpectedFellowshipLogsConnectionIdentity(
  identity: string | null,
) {
  return <A, Err, Requirements>(effect: E.Effect<A, Err, Requirements>) => {
    return effect.pipe(
      E.provideService(ExpectedFellowshipLogsConnectionIdentity, identity),
    );
  };
}
