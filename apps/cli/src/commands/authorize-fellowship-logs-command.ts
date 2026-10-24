import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Prompt from "effect/cli/Prompt";
import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as Stream from "effect/Stream";

import { type FellowshipLogsOAuthProviderError } from "@frt/api/errors/fellowship-logs-oauth-provider-error.ts";
import { NodeHttpClientLayer } from "@frt/api/layers/node-platform-layer.ts";
import { EncryptionKeyDirectory } from "@frt/api/services/encryption/encryption-key-directory.ts";
import { FellowshipLogsAccessToken } from "@frt/api/services/fellowship-logs-access-token/fellowship-logs-access-token-service.ts";
import {
  FellowshipLogsAuthorization,
  type FellowshipLogsAuthorizationStatus,
} from "@frt/api/services/fellowship-logs-authorization/fellowship-logs-authorization-service.ts";
import {
  FellowshipLogsConnection,
  type FellowshipLogsSessionTokens,
} from "@frt/api/services/fellowship-logs-connection/fellowship-logs-connection-service.ts";
import { FellowshipLogsOAuthClient } from "@frt/api/services/fellowship-logs-oauth-client/fellowship-logs-oauth-client-service.ts";
import { FellowshipLogsPointSystemOptIn } from "@frt/api/services/fellowship-logs-point-system-opt-in/fellowship-logs-point-system-opt-in-service.ts";
import { ProtectedValueStorage } from "@frt/api/services/protected-value-storage/protected-value-storage-service.ts";
import { SystemBrowser } from "@frt/api/services/system-browser/system-browser-service.ts";
import { checkPointPolicy } from "@frt/cli/commands/check-fellowship-logs-point-policy.ts";
import { FellowshipLogsAuthorizationTransactionDAO } from "@frt/db/daos/fellowship-logs-authorization-transaction/fellowship-logs-authorization-transaction-dao.ts";
import { FellowshipLogsConnectionDAO } from "@frt/db/daos/fellowship-logs-connection/fellowship-logs-connection-dao.ts";
import { makeMainDatabaseLayer } from "@frt/db/databases/main-database.ts";
import {
  type FellowshipLogsClientId,
  FellowshipLogsClientIdSchema,
} from "@frt/shared/fellowship-logs/fellowship-logs-client-credentials-schema.ts";
import { FELLOWSHIP_LOGS_OWN_CLIENT_REQUIREMENTS } from "@frt/shared/fellowship-logs/fellowship-logs-own-client-requirements.ts";

function stringifyJson(value: unknown) {
  return JSON.stringify(value, null, 2);
}

function formatOwnClientRequirements() {
  return FELLOWSHIP_LOGS_OWN_CLIENT_REQUIREMENTS.map(
    (requirement) => `- ${requirement}`,
  ).join("\n");
}

function needsOwnClientGuidance(status: FellowshipLogsAuthorizationStatus) {
  if (status._tag === "Expired") {
    return status.profile === "OWN_CLIENT_USER";
  }

  return status._tag === "Failed" && status.failure === "OwnClientRejected";
}

function makeThrowawayAuthorizationLayer(directory: string, path: Path.Path) {
  const DAOLayer = Layer.mergeAll(
    FellowshipLogsAuthorizationTransactionDAO.layer,
    FellowshipLogsConnectionDAO.layer,
  ).pipe(
    Layer.provideMerge(makeMainDatabaseLayer(path.join(directory, "main.db"))),
  );
  const ProtectedValueStorageLayer = ProtectedValueStorage.localLayer.pipe(
    Layer.provide(
      Layer.succeed(EncryptionKeyDirectory, path.join(directory, "security")),
    ),
  );
  const ConnectionLayer = FellowshipLogsConnection.layerNoDeps.pipe(
    Layer.provide(Layer.mergeAll(DAOLayer, ProtectedValueStorageLayer)),
  );
  const AccessTokenLayer = FellowshipLogsAccessToken.layerNoDeps.pipe(
    Layer.provide(
      Layer.mergeAll(
        ConnectionLayer,
        ProtectedValueStorageLayer,
        FellowshipLogsOAuthClient.layer,
      ),
    ),
  );
  const PointSystemOptInLayer = FellowshipLogsPointSystemOptIn.layer.pipe(
    Layer.provide(Layer.mergeAll(AccessTokenLayer, ConnectionLayer)),
  );
  const AuthorizationLayer = FellowshipLogsAuthorization.layerNoDeps.pipe(
    Layer.provide(
      Layer.mergeAll(
        DAOLayer,
        ConnectionLayer,
        PointSystemOptInLayer,
        ProtectedValueStorageLayer,
        FellowshipLogsOAuthClient.layer,
        SystemBrowser.unavailableLayer,
      ),
    ),
  );

  return Layer.mergeAll(
    AccessTokenLayer,
    AuthorizationLayer,
    ConnectionLayer,
    DAOLayer,
    FellowshipLogsOAuthClient.layer,
    NodeHttpClientLayer,
  );
}

function describeOutcome<A>(
  result: Result.Result<A, FellowshipLogsOAuthProviderError>,
) {
  return Result.match(result, {
    onFailure: (error) => {
      return {
        accepted: false,
        providerError: error.providerError,
        reason: error.reason,
        status: error.status,
      };
    },
    onSuccess: () => {
      return { accepted: true };
    },
  });
}

const readSessionTokens = E.gen(function* () {
  const connection = yield* FellowshipLogsConnection;
  const credentials = yield* connection.getCredentials();

  if (
    Option.isNone(credentials) ||
    credentials.value.profile === "OWN_CLIENT" ||
    credentials.value.tokens === null
  ) {
    return Option.none<FellowshipLogsSessionTokens>();
  }

  return Option.some(credentials.value.tokens);
});

const expireStoredAccessToken = E.gen(function* () {
  const connectionDAO = yield* FellowshipLogsConnectionDAO;
  const connection = Option.getOrThrow(yield* connectionDAO.get());

  yield* connectionDAO.save({
    ...connection,
    accessTokenExpiresAt: yield* DateTime.now,
  });
});

const checkRefresh = E.gen(function* () {
  const accessToken = yield* FellowshipLogsAccessToken;
  const oauthClient = yield* FellowshipLogsOAuthClient;
  const before = yield* readSessionTokens;

  if (Option.isNone(before) || before.value.refreshToken === null) {
    return { skipped: "No signed-in session with a refresh token." };
  }

  yield* expireStoredAccessToken;

  const refreshed = yield* accessToken.get().pipe(E.result);

  if (Result.isFailure(refreshed)) {
    return { refreshError: refreshed.failure._tag, refreshed: false };
  }

  const after = Option.getOrThrow(yield* readSessionTokens);
  const newAccessToken = refreshed.success.accessToken;
  const newAccessTokenUser = yield* oauthClient
    .getCurrentUser(newAccessToken)
    .pipe(E.result);
  const previousAccessToken = yield* oauthClient
    .getCurrentUser(before.value.accessToken)
    .pipe(E.result);
  const replayedRefreshToken = yield* oauthClient
    .refreshTokens({
      clientId: refreshed.success.clientId,
      refreshToken: before.value.refreshToken,
    })
    .pipe(E.result);
  const currentAccessTokenAfterReplay = yield* oauthClient
    .getCurrentUser(newAccessToken)
    .pipe(E.result);
  const finalTokens = Option.getOrThrow(yield* readSessionTokens);

  return {
    currentAccessTokenAfterReplay: describeOutcome(
      currentAccessTokenAfterReplay,
    ),
    newAccessToken: describeOutcome(newAccessTokenUser),
    previousAccessToken: describeOutcome(previousAccessToken),
    refreshed: true,
    replayedRefreshToken: describeOutcome(replayedRefreshToken),
    rotatedAccessToken:
      Redacted.value(newAccessToken) !==
      Redacted.value(before.value.accessToken),
    rotatedRefreshToken:
      after.refreshToken !== null &&
      Redacted.value(after.refreshToken) !==
        Redacted.value(before.value.refreshToken),
    storedAccessTokenExpiresAt: after.accessTokenExpiresAt,
    storedTokensMatchReturnedToken:
      Redacted.value(after.accessToken) === Redacted.value(newAccessToken),
    storedTokensUnchangedByReplay:
      Redacted.value(finalTokens.accessToken) ===
      Redacted.value(after.accessToken),
  };
});

const checkRevocation = E.gen(function* () {
  const accessToken = yield* FellowshipLogsAccessToken;
  const connection = yield* FellowshipLogsConnection;
  const oauthClient = yield* FellowshipLogsOAuthClient;
  const before = yield* readSessionTokens;
  const summary = yield* connection.getSummary();

  if (
    Option.isNone(before) ||
    before.value.refreshToken === null ||
    Option.isNone(summary)
  ) {
    return { skipped: "No signed-in session with a refresh token." };
  }

  const revoked = yield* Prompt.run(
    Prompt.Confirm({
      initial: false,
      message:
        "Remove this app under Authorized Applications on fellowshiplogs.com, then confirm. Choose no to skip the revocation check.",
    }),
  );

  if (!revoked) {
    return { skipped: "The app was not removed." };
  }

  const accessTokenAfterRevocation = yield* oauthClient
    .getCurrentUser(before.value.accessToken)
    .pipe(E.result);
  const refreshAfterRevocation = yield* oauthClient
    .refreshTokens({
      clientId: summary.value.clientId,
      refreshToken: before.value.refreshToken,
    })
    .pipe(E.result);

  if (
    Result.isFailure(accessTokenAfterRevocation) &&
    accessTokenAfterRevocation.failure.status === 401
  ) {
    yield* accessToken.reportRejected(before.value.accessToken).pipe(E.ignore);
  }

  return {
    accessTokenAfterRevocation: describeOutcome(accessTokenAfterRevocation),
    refreshAfterRevocation: describeOutcome(refreshAfterRevocation),
    statusAfterReport: Option.map(
      yield* connection.getSummary(),
      (value) => value.status,
    ).pipe(Option.getOrNull),
  };
});

const verifyStoredSession = E.gen(function* () {
  const connection = yield* FellowshipLogsConnection;
  const oauthClient = yield* FellowshipLogsOAuthClient;
  const summary = yield* connection.getSummary();
  const credentials = yield* connection.getCredentials();

  if (
    Option.isNone(credentials) ||
    credentials.value.profile === "OWN_CLIENT" ||
    credentials.value.tokens === null
  ) {
    return { credentials: null, summary: Option.getOrNull(summary) };
  }

  const { tokens } = credentials.value;
  const storedUser = yield* oauthClient
    .getCurrentUser(tokens.accessToken)
    .pipe(E.result);

  return {
    credentials: {
      accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      hasRefreshToken: tokens.refreshToken !== null,
      storedAccessTokenUserMatches:
        storedUser._tag === "Success" &&
        Option.isSome(summary) &&
        storedUser.success.id === summary.value.connectedUserId,
      storedAccessTokenWorks: storedUser._tag === "Success",
    },
    summary: Option.getOrNull(summary),
  };
});

type AuthorizeFellowshipLogsInput = {
  readonly checkPointPolicy: boolean;
  readonly checkRefresh: boolean;
  readonly checkRevocation: boolean;
  readonly clientId: Option.Option<FellowshipLogsClientId>;
};

const authorizeFellowshipLogs = E.fn("authorizeFellowshipLogs")(function* ({
  checkPointPolicy: shouldCheckPointPolicy,
  checkRefresh: shouldCheckRefresh,
  checkRevocation: shouldCheckRevocation,
  clientId,
}: AuthorizeFellowshipLogsInput) {
  const authorization = yield* FellowshipLogsAuthorization;
  const connection = yield* FellowshipLogsConnection;
  const expectedGeneration = Option.match(yield* connection.getSummary(), {
    onNone: () => null,
    onSome: (summary) => summary.generation,
  });

  const started = yield* authorization.start(
    Option.match(clientId, {
      onNone: () => ({
        allowLocalFallback: true,
        expectedGeneration,
        profile: "FELLOWSHIP_RUN_TRACKER_USER" as const,
      }),
      onSome: (value) => ({
        allowLocalFallback: true,
        clientId: value,
        expectedGeneration,
        profile: "OWN_CLIENT_USER" as const,
      }),
    }),
  );
  const authorizationUrl = new URL(Redacted.value(started.authorizationUrl));

  if (started.profile === "OWN_CLIENT_USER") {
    yield* Console.log(formatOwnClientRequirements());
  }

  yield* Console.log(
    `\nOpen this URL in your browser, sign in, and approve or deny the request.\nListening on ${authorizationUrl.searchParams.get("redirect_uri")} until ${started.expiresAt.toString()}. Press Ctrl+C to cancel.\n\n${authorizationUrl.toString()}\n`,
  );

  const status = yield* authorization.statusChanges.pipe(
    Stream.filter((value) => value._tag !== "Idle" && value._tag !== "Pending"),
    Stream.runHead,
    E.map(Option.getOrThrow),
  );
  const stored = yield* verifyStoredSession;

  if (needsOwnClientGuidance(status)) {
    yield* Console.log(
      `\nThe client did not complete authorization. Check its setup:\n${formatOwnClientRequirements()}`,
    );
  }

  yield* Console.log(
    stringifyJson({
      browserLaunch: started.browserLaunch,
      profile: started.profile,
      status,
      storageProtection: started.storageProtection,
      stored,
    }),
  );

  if (status._tag !== "Connected") {
    return;
  }

  if (shouldCheckRefresh) {
    yield* Console.log(
      "\nForcing the stored access token to expire and refreshing through the app's services.",
    );
    yield* Console.log(stringifyJson({ refresh: yield* checkRefresh }));
  }

  if (shouldCheckPointPolicy) {
    const accessToken = yield* FellowshipLogsAccessToken;
    const session = yield* accessToken.get();

    yield* Console.log(
      stringifyJson({
        pointPolicy: yield* checkPointPolicy(session.accessToken),
      }),
    );
  }

  if (shouldCheckRevocation) {
    yield* Console.log(stringifyJson({ revocation: yield* checkRevocation }));
  }
});

const runAuthorizeFellowshipLogsCommand = E.fn(
  "runAuthorizeFellowshipLogsCommand",
)(function* (input: AuthorizeFellowshipLogsInput) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const directory = yield* fileSystem.makeTempDirectoryScoped({
    prefix: "frt-authorize-",
  });

  yield* Console.log(
    `Using a throwaway database and encryption key in ${directory}. It is deleted when this command exits.`,
  );

  return yield* authorizeFellowshipLogs(input).pipe(
    // @effect-diagnostics-next-line strictEffectProvide:off
    E.provide(makeThrowawayAuthorizationLayer(directory, path)),
  );
}, E.scoped);

export const authorizeFellowshipLogsCommand = Command.make(
  "authorize-fellowship-logs",
  {
    checkPointPolicy: Flag.Boolean("check-point-policy").pipe(
      Flag.withDefault(false),
      Flag.withDescription(
        "After connecting, read the [User-Eligible Points] labels for every field the import queries select, then run import-shaped, mixed, and @onlySpendUserPoints queries and report each result and point split. The mixed query includes rankings, which cost about 56 application points.",
      ),
    ),
    checkRefresh: Flag.Boolean("check-refresh").pipe(
      Flag.withDefault(false),
      Flag.withDescription(
        "After connecting, expire the stored access token, refresh through the app's services, and check rotation, previous-token revocation, and refresh-token replay.",
      ),
    ),
    checkRevocation: Flag.Boolean("check-revocation").pipe(
      Flag.withDefault(false),
      Flag.withDescription(
        "After connecting, wait while you remove the app under Authorized Applications, then check whether the issued access and refresh tokens still work.",
      ),
    ),
    clientId: Flag.String("client-id").pipe(
      Flag.withSchema(FellowshipLogsClientIdSchema),
      Flag.optional,
      Flag.withDescription(
        `Authorize your own public client with PKCE instead of FELLOWSHIP_LOGS_OAUTH_CLIENT_ID. ${FELLOWSHIP_LOGS_OWN_CLIENT_REQUIREMENTS.join(" ")}`,
      ),
    ),
  },
  runAuthorizeFellowshipLogsCommand,
).pipe(
  Command.withDescription(
    "Run the app's Fellowship Logs PKCE authorization against Fellowship Logs using a throwaway database.",
  ),
);
