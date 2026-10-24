import * as E from "effect/Effect";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import { describe, expect, test } from "vitest";

import { FellowshipLogsReauthorizationRequiredError } from "@frt/api/errors/fellowship-logs-access-token-error.ts";
import { FellowshipLogsOAuthProviderError } from "@frt/api/errors/fellowship-logs-oauth-provider-error.ts";
import {
  FellowshipLogsAccessToken,
  type FellowshipLogsAccessTokenShape,
} from "@frt/api/services/fellowship-logs-access-token/fellowship-logs-access-token-service.ts";
import {
  getFellowshipLogsConnectionIdentity,
  withExpectedFellowshipLogsConnectionIdentity,
} from "@frt/api/services/fellowship-logs-connection/fellowship-logs-connection-identity.ts";
import {
  FellowshipLogsConnection,
  type FellowshipLogsConnectionShape,
  type FellowshipLogsCredentials,
} from "@frt/api/services/fellowship-logs-connection/fellowship-logs-connection-service.ts";
import { makeConnectionGatewayAccessSource } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-access.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { FellowshipLogsClientIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-client-credentials-schema.ts";
import { FellowshipLogsConnectedUserIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";

const CLIENT_ID = Schema.decodeSync(FellowshipLogsClientIdSchema)("client-id");
const CONNECTED_USER_ID = Schema.decodeSync(
  FellowshipLogsConnectedUserIdSchema,
)("13100");

function makeConnection(
  credentials: Option.Option<FellowshipLogsCredentials>,
): FellowshipLogsConnectionShape {
  return {
    changes: Stream.empty,
    disconnect: () => E.die("Unexpected disconnect."),
    getCredentials: () => E.succeed(credentials),
    getSummary: () => E.die("Unexpected summary read."),
    replaceTokens: () => E.die("Unexpected token replacement."),
    requireReauthorization: () => E.die("Unexpected reauthorization."),
    saveAuthorizedSession: () => E.die("Unexpected session save."),
    saveOwnClient: () => E.die("Unexpected client save."),
    setPointSystemOptInRequired: () => E.die("Unexpected opt-in update."),
    withRequestLease: (effect) => effect,
  };
}

function makeAccessToken(
  get: FellowshipLogsAccessTokenShape["get"],
): FellowshipLogsAccessTokenShape {
  return {
    get,
    reportRejected: () => E.void,
  };
}

const unexpectedAccessToken = makeAccessToken(() => {
  return E.die("Unexpected access-token read.");
});

function getAccess(
  credentials: Option.Option<FellowshipLogsCredentials>,
  accessToken: FellowshipLogsAccessTokenShape = unexpectedAccessToken,
  expectedIdentity: string | null = null,
) {
  return E.gen(function* () {
    const source = yield* makeConnectionGatewayAccessSource({
      refuseWithoutPointSystemOptIn: true,
    });

    return yield* source
      .get()
      .pipe(
        withExpectedFellowshipLogsConnectionIdentity(expectedIdentity),
        E.result,
      );
  }).pipe(
    E.provideService(FellowshipLogsConnection, makeConnection(credentials)),
    E.provideService(FellowshipLogsAccessToken, accessToken),
    runTest,
  );
}

const signedInCredentials = {
  clientId: CLIENT_ID,
  connectedUserId: CONNECTED_USER_ID,
  pointSystemOptInRequired: false,
  profile: "FELLOWSHIP_RUN_TRACKER_USER",
  tokens: null,
} satisfies FellowshipLogsCredentials;

const ownClientCredentials = {
  clientId: CLIENT_ID,
  clientSecret: Redacted.make("secret"),
  profile: "OWN_CLIENT",
} satisfies FellowshipLogsCredentials;

describe("makeConnectionGatewayAccessSource", () => {
  test("refuses a request for a job queued under another connection, before reading a token", async () => {
    const result = await getAccess(
      Option.some(signedInCredentials),
      unexpectedAccessToken,
      getFellowshipLogsConnectionIdentity(ownClientCredentials),
    );

    expect(result).toMatchObject({
      failure: {
        _tag: "FellowshipLogsGatewayAccessError",
        reason: "ConnectionChanged",
      },
    });
  });

  test("allows a request for a job queued under the active connection", async () => {
    const result = await getAccess(
      Option.some(ownClientCredentials),
      unexpectedAccessToken,
      getFellowshipLogsConnectionIdentity(ownClientCredentials),
    );

    expect(result).toMatchObject({
      success: { clientId: CLIENT_ID, profile: "OWN_CLIENT" },
    });
  });

  test("fails as not connected without an active connection", async () => {
    const result = await getAccess(Option.none());

    expect(result).toMatchObject({
      failure: {
        _tag: "FellowshipLogsGatewayAccessError",
        reason: "NotConnected",
      },
    });
  });

  test("uses client credentials for the client-secret profile", async () => {
    const result = await getAccess(
      Option.some({
        clientId: CLIENT_ID,
        clientSecret: Redacted.make("secret"),
        profile: "OWN_CLIENT",
      }),
    );

    expect(result).toMatchObject({
      success: { clientId: CLIENT_ID, profile: "OWN_CLIENT" },
    });
  });

  test("uses the signed-in session's access token and profile", async () => {
    const result = await getAccess(
      Option.some(signedInCredentials),
      makeAccessToken(() => {
        return E.succeed({
          accessToken: Redacted.make("user-token"),
          clientId: CLIENT_ID,
          profile: "FELLOWSHIP_RUN_TRACKER_USER",
        });
      }),
    );

    expect(result._tag).toBe("Success");
    expect(result).toMatchObject({
      success: { profile: "FELLOWSHIP_RUN_TRACKER_USER" },
    });
  });

  test("refuses the recommended profile while the point-system opt-in is missing", async () => {
    const result = await getAccess(
      Option.some({ ...signedInCredentials, pointSystemOptInRequired: true }),
    );

    expect(result).toMatchObject({
      failure: {
        _tag: "FellowshipLogsGatewayPointPolicyError",
        reason: "PointSystemOptInRequired",
      },
    });
  });

  test("requires reauthorization when the session cannot be used", async () => {
    const result = await getAccess(
      Option.some(signedInCredentials),
      makeAccessToken(() => {
        return E.fail(
          new FellowshipLogsReauthorizationRequiredError({
            profile: "FELLOWSHIP_RUN_TRACKER_USER",
            reason: "PreviouslyRequired",
          }),
        );
      }),
    );

    expect(result).toMatchObject({
      failure: {
        _tag: "FellowshipLogsGatewayAccessError",
        reason: "ReauthorizationRequired",
      },
    });
  });

  test("treats a provider outage during refresh as a retryable request error", async () => {
    const result = await getAccess(
      Option.some(signedInCredentials),
      makeAccessToken(() => {
        return E.fail(
          new FellowshipLogsOAuthProviderError({
            operation: "RefreshTokens",
            providerError: null,
            reason: "Unavailable",
            status: 503,
          }),
        );
      }),
    );

    expect(result).toMatchObject({
      failure: {
        _tag: "FellowshipLogsGatewayRequestError",
        operation: "GetAccessToken",
      },
    });
  });
});
