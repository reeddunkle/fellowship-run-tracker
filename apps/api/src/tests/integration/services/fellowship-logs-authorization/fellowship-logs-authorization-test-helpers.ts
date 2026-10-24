import { Buffer } from "node:buffer";

import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as ConfigProvider from "effect/ConfigProvider";
import * as E from "effect/Effect";
import * as HttpClient from "effect/http/HttpClient";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as Stream from "effect/Stream";
import * as TestClock from "effect/testing/TestClock";

import { NodeHttpClientLayer } from "@frt/api/layers/node-platform-layer.ts";
import { type EncryptionShape } from "@frt/api/services/encryption/encryption-service.ts";
import {
  FellowshipLogsAuthorization,
  type FellowshipLogsAuthorizationStatus,
} from "@frt/api/services/fellowship-logs-authorization/fellowship-logs-authorization-service.ts";
import {
  FellowshipLogsConnection,
  type FellowshipLogsConnectionShape,
  type FellowshipLogsCredentials,
} from "@frt/api/services/fellowship-logs-connection/fellowship-logs-connection-service.ts";
import {
  FellowshipLogsOAuthClient,
  type FellowshipLogsOAuthClientShape,
} from "@frt/api/services/fellowship-logs-oauth-client/fellowship-logs-oauth-client-service.ts";
import {
  FellowshipLogsPointSystemOptIn,
  type FellowshipLogsPointSystemOptInShape,
} from "@frt/api/services/fellowship-logs-point-system-opt-in/fellowship-logs-point-system-opt-in-service.ts";
import {
  ProtectedValueStorage,
  type ProtectedValueStorageShape,
} from "@frt/api/services/protected-value-storage/protected-value-storage-service.ts";
import {
  SystemBrowser,
  type SystemBrowserShape,
} from "@frt/api/services/system-browser/system-browser-service.ts";
import { FellowshipLogsAuthorizationTransactionDAO } from "@frt/db/daos/fellowship-logs-authorization-transaction/fellowship-logs-authorization-transaction-dao.ts";
import { FellowshipLogsConnectionDAO } from "@frt/db/daos/fellowship-logs-connection/fellowship-logs-connection-dao.ts";
import { makeMainDatabaseLayer } from "@frt/db/databases/main-database.ts";
import { type FellowshipLogsAuthorizationTransactionModel } from "@frt/db/models/fellowship-logs-authorization-transaction-model.ts";
import {
  ENCRYPTION_ALGORITHM_LABEL,
  EncryptedValueSchema,
} from "@frt/db/validation/encryption/encrypted-value-schema.ts";
import { ProtectedValueSchema } from "@frt/db/validation/encryption/protected-value-schema.ts";
import { FellowshipLogsClientIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-client-credentials-schema.ts";
import {
  FellowshipLogsConnectedUserIdSchema,
  FellowshipLogsConnectedUserNameSchema,
} from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";

export const AUTHORIZATION_ENDPOINT =
  "https://www.fellowshiplogs.com/oauth/authorize";
export const FELLOWSHIP_RUN_TRACKER_CLIENT_ID =
  "fellowship-run-tracker-client-id";
export const RECOMMENDED_CLIENT_ID = Schema.decodeSync(
  FellowshipLogsClientIdSchema,
)(FELLOWSHIP_RUN_TRACKER_CLIENT_ID);
export const OWN_CLIENT_ID = Schema.decodeSync(FellowshipLogsClientIdSchema)(
  "own-client-id",
);
export const LOOPBACK_REDIRECT_URI_PATTERN =
  /^http:\/\/127\.0\.0\.1:[1-9]\d*\/oauth\/callback$/u;

export const ACCESS_TOKEN = "access-token-value";
export const REFRESH_TOKEN = "refresh-token-value";
export const AUTHORIZATION_CODE = "authorization-code-value";
export const ACCESS_TOKEN_LIFETIME_SECONDS = 31_104_000;
export const CONNECTED_USER = {
  id: FellowshipLogsConnectedUserIdSchema.make("12345"),
  name: FellowshipLogsConnectedUserNameSchema.make("Player Name"),
};

export const DEFAULT_CONFIG = {
  FELLOWSHIP_LOGS_OAUTH_CLIENT_ID: FELLOWSHIP_RUN_TRACKER_CLIENT_ID,
};

const encodeProtectedValue = Schema.encodeSync(ProtectedValueSchema);
const decodeProtectedValue = Schema.decodeSync(ProtectedValueSchema);
const encodeEncryptedValue = Schema.encodeSync(EncryptedValueSchema);
const decodeEncryptedValue = Schema.decodeSync(EncryptedValueSchema);

export const OsBackedProtectedValueStorage: ProtectedValueStorageShape = {
  getProtectionStatus: () =>
    E.succeed({
      activeProtection: "OS_BACKED",
      requiresLocalFallbackAcknowledgement: false,
    }),
  protect: (value) =>
    E.succeed(
      encodeProtectedValue({
        protection: "OS_BACKED",
        value: Buffer.from(Redacted.value(value)).toString("base64url"),
        version: 1,
      }),
    ),
  unprotect: (value) =>
    E.succeed(
      Redacted.make(
        Buffer.from(decodeProtectedValue(value).value, "base64url").toString(
          "utf8",
        ),
      ),
    ),
};

export const LocalEncryption: EncryptionShape = {
  decrypt: (value) =>
    E.succeed(
      Redacted.make(
        Buffer.from(
          decodeEncryptedValue(value).ciphertext,
          "base64url",
        ).toString("utf8"),
      ),
    ),
  encrypt: (value) =>
    E.succeed(
      encodeEncryptedValue({
        algorithm: ENCRYPTION_ALGORITHM_LABEL,
        ciphertext: Buffer.from(Redacted.value(value)).toString("base64url"),
        iv: "initialization-vector",
        version: 1,
      }),
    ),
};

type ExchangeCodeCall = {
  readonly clientId: string;
  readonly code: string;
  readonly codeVerifier: string;
  readonly redirectUri: string;
};

export function makeOAuthClient(
  overrides: Partial<FellowshipLogsOAuthClientShape> = {},
) {
  const exchangeCodeCalls: Array<ExchangeCodeCall> = [];
  const client: FellowshipLogsOAuthClientShape = {
    checkClientCredentials: () => E.die("Unexpected client-credentials check."),
    exchangeCode: (options) => {
      exchangeCodeCalls.push({
        clientId: options.clientId,
        code: Redacted.value(options.code),
        codeVerifier: Redacted.value(options.codeVerifier),
        redirectUri: options.redirectUri,
      });

      return E.succeed({
        accessToken: Redacted.make(ACCESS_TOKEN),
        expiresInSeconds: ACCESS_TOKEN_LIFETIME_SECONDS,
        refreshToken: Redacted.make(REFRESH_TOKEN),
      });
    },
    getCurrentUser: () => E.succeed(CONNECTED_USER),
    refreshTokens: () => E.die("Unexpected token refresh."),
    ...overrides,
  };

  return { client, exchangeCodeCalls };
}

export function makeSystemBrowser(
  open: SystemBrowserShape["open"] = () => E.void,
) {
  const openedUrls: Array<string> = [];
  const browser: SystemBrowserShape = {
    open: (url) => {
      openedUrls.push(Redacted.value(url));

      return open(url);
    },
  };

  return { browser, openedUrls };
}

export function makePointSystemOptIn(
  check: FellowshipLogsPointSystemOptInShape["check"] = () =>
    E.succeed("OPTED_IN"),
) {
  const checks = { count: 0 };
  const service: FellowshipLogsPointSystemOptInShape = {
    check: () => {
      checks.count += 1;

      return check();
    },
  };

  return { checks, service };
}

export function makeTestLayer({
  config = DEFAULT_CONFIG,
  oauthClient = makeOAuthClient().client,
  pointSystemOptIn = makePointSystemOptIn().service,
  protectedValueStorage = OsBackedProtectedValueStorage,
  systemBrowser = makeSystemBrowser().browser,
}: {
  readonly config?: Record<string, string>;
  readonly oauthClient?: FellowshipLogsOAuthClientShape;
  readonly pointSystemOptIn?: FellowshipLogsPointSystemOptInShape;
  readonly protectedValueStorage?: ProtectedValueStorageShape;
  readonly systemBrowser?: SystemBrowserShape;
} = {}) {
  const DAOLayer = Layer.mergeAll(
    FellowshipLogsAuthorizationTransactionDAO.layer,
    FellowshipLogsConnectionDAO.layer,
  ).pipe(Layer.provideMerge(makeMainDatabaseLayer(":memory:")));
  const ProtectedValueStorageLayer = Layer.succeed(
    ProtectedValueStorage,
    protectedValueStorage,
  );
  const ConnectionLayer = FellowshipLogsConnection.layerNoDeps.pipe(
    Layer.provide(
      Layer.mergeAll(DAOLayer, NodeCrypto.layer, ProtectedValueStorageLayer),
    ),
  );
  const AuthorizationLayer = FellowshipLogsAuthorization.layerNoDeps.pipe(
    Layer.provide(
      Layer.mergeAll(
        DAOLayer,
        ConnectionLayer,
        ProtectedValueStorageLayer,
        Layer.succeed(FellowshipLogsOAuthClient, oauthClient),
        Layer.succeed(FellowshipLogsPointSystemOptIn, pointSystemOptIn),
        Layer.succeed(SystemBrowser, systemBrowser),
        ConfigProvider.layer(ConfigProvider.fromUnknown(config)),
      ),
    ),
  );

  return Layer.mergeAll(
    DAOLayer,
    ConnectionLayer,
    AuthorizationLayer,
    NodeHttpClientLayer,
    TestClock.layer(),
  );
}

export function makeCallbackUrl(
  transaction: FellowshipLogsAuthorizationTransactionModel,
  parameters: Readonly<Record<string, string>>,
) {
  const url = new URL(transaction.redirectUri);

  for (const [name, value] of Object.entries(parameters)) {
    url.searchParams.set(name, value);
  }

  return url.toString();
}

export const sendBrowserCallback = E.fnUntraced(function* (
  callbackUrl: string,
) {
  const httpClient = yield* HttpClient.HttpClient;
  const response = yield* httpClient.get(callbackUrl).pipe(E.orDie);

  return response.status;
});

export const isListening = E.fnUntraced(function* (redirectUri: string) {
  const httpClient = yield* HttpClient.HttpClient;

  return yield* httpClient
    .get(new URL("/liveness", redirectUri).toString())
    .pipe(
      E.as(true),
      E.orElseSucceed(() => false),
    );
});

export const waitUntilClosed = (
  redirectUri: string,
  remainingAttempts = 200,
): E.Effect<boolean, never, HttpClient.HttpClient> =>
  isListening(redirectUri).pipe(
    E.flatMap((listening) => {
      if (!listening) {
        return E.succeed(true);
      }

      return remainingAttempts === 0
        ? E.succeed(false)
        : E.yieldNow.pipe(
            E.andThen(waitUntilClosed(redirectUri, remainingAttempts - 1)),
          );
    }),
  );

export const waitForStatus = E.fnUntraced(function* (
  tag: FellowshipLogsAuthorizationStatus["_tag"],
) {
  const authorization = yield* FellowshipLogsAuthorization;

  return yield* authorization.statusChanges.pipe(
    Stream.filter((status) => status._tag === tag),
    Stream.runHead,
    E.map(Option.getOrThrow),
  );
});

export const getGeneration = (connection: FellowshipLogsConnectionShape) =>
  connection.getSummary().pipe(
    E.map(
      Option.match({
        onNone: () => null,
        onSome: (summary) => summary.generation,
      }),
    ),
  );

export const startAuthorization = E.gen(function* () {
  const authorization = yield* FellowshipLogsAuthorization;
  const connection = yield* FellowshipLogsConnection;
  const transactionDAO = yield* FellowshipLogsAuthorizationTransactionDAO;

  const started = yield* authorization.start({
    allowLocalFallback: false,
    expectedGeneration: yield* getGeneration(connection),
    profile: "FELLOWSHIP_RUN_TRACKER_USER",
  });

  return {
    started,
    transaction: Option.getOrThrow(yield* transactionDAO.get()),
  };
});

export const readStoredState = E.gen(function* () {
  const connection = yield* FellowshipLogsConnection;
  const transactionDAO = yield* FellowshipLogsAuthorizationTransactionDAO;

  return {
    credentials: yield* connection.getCredentials(),
    summary: yield* connection.getSummary(),
    transaction: yield* transactionDAO.get(),
  };
});

export function revealCredentials(credentials: FellowshipLogsCredentials) {
  return credentials.profile === "OWN_CLIENT" || credentials.tokens === null
    ? null
    : {
        accessToken: Redacted.value(credentials.tokens.accessToken),
        accessTokenExpiresAt: credentials.tokens.accessTokenExpiresAt,
        refreshToken:
          credentials.tokens.refreshToken === null
            ? null
            : Redacted.value(credentials.tokens.refreshToken),
      };
}

export const revealAuthorizationUrl = (
  authorizationUrl: Redacted.Redacted<string>,
) => new URL(Redacted.value(authorizationUrl));
