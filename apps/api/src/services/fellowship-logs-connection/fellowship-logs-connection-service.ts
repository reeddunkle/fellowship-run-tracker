import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import type * as Stream from "effect/Stream";
import * as SubscriptionRef from "effect/SubscriptionRef";

import {
  FellowshipLogsConnectionChangedError,
  FellowshipLogsConnectionError,
} from "@frt/api/errors/fellowship-logs-connection-error.ts";
import {
  type LocalProtectionAcknowledgementRequiredError,
  type ProtectedValueStorageError,
} from "@frt/api/errors/protected-value-storage-error.ts";
import {
  ProtectedValueStorage,
  type ProtectedValueStorageShape,
} from "@frt/api/services/protected-value-storage/protected-value-storage-service.ts";
import { FellowshipLogsAuthorizationTransactionDAO } from "@frt/db/daos/fellowship-logs-authorization-transaction/fellowship-logs-authorization-transaction-dao.ts";
import { FellowshipLogsConnectionDAO } from "@frt/db/daos/fellowship-logs-connection/fellowship-logs-connection-dao.ts";
import { MainDatabase } from "@frt/db/databases/main-database.ts";
import { type FellowshipLogsConnectionModel } from "@frt/db/models/fellowship-logs-connection-model.ts";
import {
  type ProtectedValue,
  ProtectedValueSchema,
} from "@frt/db/validation/encryption/protected-value-schema.ts";
import { type FellowshipLogsClientId } from "@frt/shared/fellowship-logs/fellowship-logs-client-credentials-schema.ts";
import {
  FELLOWSHIP_LOGS_POINT_POLICY_VERSION,
  type FellowshipLogsAuthorizedProfile,
  type FellowshipLogsConnectedUserId,
  type FellowshipLogsConnectedUserName,
  type FellowshipLogsConnectionGeneration,
  FellowshipLogsConnectionGenerationSchema,
  type FellowshipLogsConnectionStatus,
  type FellowshipLogsStorageProtection,
} from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";

export type FellowshipLogsConnectionSummary = {
  readonly clientId: FellowshipLogsClientId;
  readonly connectedUserId: FellowshipLogsConnectedUserId | null;
  readonly connectedUserName: FellowshipLogsConnectedUserName | null;
  readonly generation: FellowshipLogsConnectionGeneration;
  readonly pointPolicyVersion: typeof FELLOWSHIP_LOGS_POINT_POLICY_VERSION;
  readonly profile: FellowshipLogsConnectionModel["profile"];
  readonly status: FellowshipLogsConnectionStatus;
  readonly storageProtection: FellowshipLogsStorageProtection;
};

export type FellowshipLogsSessionTokens = {
  readonly accessToken: Redacted.Redacted<string>;
  readonly accessTokenExpiresAt: DateTime.Utc;
  readonly refreshToken: Redacted.Redacted<string> | null;
};

export type FellowshipLogsCredentials =
  | {
      readonly clientId: FellowshipLogsClientId;
      readonly clientSecret: Redacted.Redacted<string>;
      readonly profile: "OWN_CLIENT";
    }
  | {
      readonly clientId: FellowshipLogsClientId;
      readonly connectedUserId: FellowshipLogsConnectedUserId | null;
      readonly pointSystemOptInRequired: boolean;
      readonly profile: FellowshipLogsAuthorizedProfile;
      readonly tokens: FellowshipLogsSessionTokens | null;
    };

type SaveOwnClientOptions = {
  readonly allowLocalFallback: boolean;
  readonly clientId: FellowshipLogsClientId;
  readonly clientSecret: Redacted.Redacted<string>;
  readonly expectedGeneration: FellowshipLogsConnectionGeneration | null;
};

type SaveAuthorizedSessionOptions = {
  readonly accessToken: Redacted.Redacted<string>;
  readonly accessTokenExpiresAt: DateTime.Utc;
  readonly allowLocalFallback: boolean;
  readonly clientId: FellowshipLogsClientId;
  readonly connectedUserId: FellowshipLogsConnectedUserId;
  readonly connectedUserName: FellowshipLogsConnectedUserName;
  readonly expectedGeneration: FellowshipLogsConnectionGeneration | null;
  readonly profile: FellowshipLogsAuthorizedProfile;
  readonly refreshToken: Redacted.Redacted<string> | null;
};

type ReplaceTokensOptions = {
  readonly accessToken: Redacted.Redacted<string>;
  readonly accessTokenExpiresAt: DateTime.Utc;
  readonly expectedAccessToken: Redacted.Redacted<string>;
  readonly refreshToken: Redacted.Redacted<string>;
};

type RequireReauthorizationOptions = {
  readonly expectedAccessToken: Redacted.Redacted<string>;
};

type SetPointSystemOptInRequiredOptions = {
  readonly connectedUserId: FellowshipLogsConnectedUserId;
  readonly required: boolean;
};

type FellowshipLogsSessionUpdate = "SESSION_CHANGED" | "UPDATED";

type ConnectionOperationError =
  | FellowshipLogsConnectionError
  | LocalProtectionAcknowledgementRequiredError;

type InstallConnectionError =
  | ConnectionOperationError
  | FellowshipLogsConnectionChangedError;

export type FellowshipLogsConnectionShape = {
  readonly changes: Stream.Stream<number>;
  readonly withRequestLease: <A, Err, Requirements>(
    effect: E.Effect<A, Err, Requirements>,
  ) => E.Effect<A, Err, Requirements>;
  readonly disconnect: () => E.Effect<void, FellowshipLogsConnectionError>;
  readonly getCredentials: () => E.Effect<
    Option.Option<FellowshipLogsCredentials>,
    FellowshipLogsConnectionError
  >;
  readonly getSummary: () => E.Effect<
    Option.Option<FellowshipLogsConnectionSummary>,
    FellowshipLogsConnectionError
  >;
  readonly replaceTokens: (
    options: ReplaceTokensOptions,
  ) => E.Effect<FellowshipLogsSessionUpdate, ConnectionOperationError>;
  readonly requireReauthorization: (
    options: RequireReauthorizationOptions,
  ) => E.Effect<FellowshipLogsSessionUpdate, FellowshipLogsConnectionError>;
  readonly saveAuthorizedSession: (
    options: SaveAuthorizedSessionOptions,
  ) => E.Effect<void, InstallConnectionError>;
  readonly saveOwnClient: (
    options: SaveOwnClientOptions,
  ) => E.Effect<void, InstallConnectionError>;
  readonly setPointSystemOptInRequired: (
    options: SetPointSystemOptInRequiredOptions,
  ) => E.Effect<FellowshipLogsSessionUpdate, FellowshipLogsConnectionError>;
};

const decodeProtectedValue = Schema.decodeUnknownEffect(ProtectedValueSchema);

const MAX_CONCURRENT_REQUEST_LEASES = 1_000;

const mapConnectionError =
  (operation: FellowshipLogsConnectionError["operation"]) => (cause: unknown) =>
    new FellowshipLogsConnectionError({ cause, operation });

const mapProtectionError = (
  cause:
    | LocalProtectionAcknowledgementRequiredError
    | ProtectedValueStorageError,
) => {
  return cause._tag === "LocalProtectionAcknowledgementRequiredError"
    ? cause
    : new FellowshipLogsConnectionError({ cause, operation: "Save" });
};

const getProtection = E.fnUntraced(function* (
  values: ReadonlyArray<ProtectedValue>,
) {
  const envelopes = yield* E.forEach(values, (value) =>
    decodeProtectedValue(value),
  ).pipe(E.mapError(mapConnectionError("Save")));
  const protections = new Set(envelopes.map((envelope) => envelope.protection));

  if (protections.size !== 1) {
    return yield* new FellowshipLogsConnectionError({
      cause: "Protected values use inconsistent protection mechanisms.",
      operation: "Save",
    });
  }

  const [protection] = protections;

  if (protection === undefined) {
    return yield* new FellowshipLogsConnectionError({
      cause: "Expected at least one protected value.",
      operation: "Save",
    });
  }

  return protection;
});

const getLocalProtectionAcknowledgedAt = E.fnUntraced(function* (
  protection: FellowshipLogsStorageProtection,
) {
  return protection === "LOCAL_KEY" ? yield* DateTime.now : null;
});

function getStatus(
  connection: FellowshipLogsConnectionModel,
): FellowshipLogsConnectionStatus {
  if (connection.profile !== "OWN_CLIENT" && connection.accessToken === null) {
    return "REAUTHORIZATION_REQUIRED";
  }

  return connection.pointSystemOptInRequiredAt === null
    ? "CONNECTED"
    : "POINT_SYSTEM_OPT_IN_REQUIRED";
}

function getSessionDetails(
  connection: FellowshipLogsConnectionModel,
  profile: FellowshipLogsAuthorizedProfile,
) {
  return {
    clientId: connection.clientId,
    connectedUserId: connection.connectedUserId,
    pointSystemOptInRequired: connection.pointSystemOptInRequiredAt !== null,
    profile,
  };
}

const unprotectCredentials = E.fnUntraced(function* (
  connection: FellowshipLogsConnectionModel,
  protectedValueStorage: ProtectedValueStorageShape,
) {
  if (connection.profile === "OWN_CLIENT") {
    if (connection.clientSecret === null) {
      return yield* new FellowshipLogsConnectionError({
        cause: "The client-secret connection has no client secret.",
        operation: "Unprotect",
      });
    }

    const clientSecret = yield* protectedValueStorage
      .unprotect(connection.clientSecret)
      .pipe(E.mapError(mapConnectionError("Unprotect")));

    return {
      clientId: connection.clientId,
      clientSecret,
      profile: connection.profile,
    } satisfies FellowshipLogsCredentials;
  }

  if (connection.accessToken === null) {
    return {
      ...getSessionDetails(connection, connection.profile),
      tokens: null,
    } satisfies FellowshipLogsCredentials;
  }

  if (connection.accessTokenExpiresAt === null) {
    return yield* new FellowshipLogsConnectionError({
      cause: "The authorized connection has no access-token expiry.",
      operation: "Unprotect",
    });
  }

  const accessToken = yield* protectedValueStorage
    .unprotect(connection.accessToken)
    .pipe(E.mapError(mapConnectionError("Unprotect")));
  const refreshToken =
    connection.refreshToken === null
      ? null
      : yield* protectedValueStorage
          .unprotect(connection.refreshToken)
          .pipe(E.mapError(mapConnectionError("Unprotect")));

  return {
    ...getSessionDetails(connection, connection.profile),
    tokens: {
      accessToken,
      accessTokenExpiresAt: connection.accessTokenExpiresAt,
      refreshToken,
    },
  } satisfies FellowshipLogsCredentials;
});

const makeFellowshipLogsConnection = E.gen(function* () {
  const authorizationTransactionDAO =
    yield* FellowshipLogsAuthorizationTransactionDAO;
  const connectionDAO = yield* FellowshipLogsConnectionDAO;
  const crypto = yield* Crypto.Crypto;
  const mainDatabase = yield* MainDatabase;
  const protectedValueStorage = yield* ProtectedValueStorage;
  const revisionRef = yield* SubscriptionRef.make(0);
  const leaseGate = yield* Semaphore.make(1);
  const requestLeases = yield* Semaphore.make(MAX_CONCURRENT_REQUEST_LEASES);

  const withRequestLease: FellowshipLogsConnectionShape["withRequestLease"] = (
    effect,
  ) =>
    E.acquireUseRelease(
      leaseGate.withPermit(requestLeases.take(1)),
      () => effect,
      () => requestLeases.release(1),
    );

  const withExclusiveLease = <A, Err, Requirements>(
    effect: E.Effect<A, Err, Requirements>,
  ) =>
    leaseGate.withPermit(
      requestLeases.withPermits(MAX_CONCURRENT_REQUEST_LEASES)(effect),
    );

  const notifyChange = <A, Err, Requirements>(
    effect: E.Effect<A, Err, Requirements>,
  ) =>
    effect.pipe(
      E.tap(() => {
        return SubscriptionRef.update(revisionRef, (revision) => {
          return revision + 1;
        });
      }),
    );

  const readSessionWithAccessToken = E.fnUntraced(function* (
    expectedAccessToken: Redacted.Redacted<string>,
  ) {
    const connection = yield* connectionDAO.get();

    if (
      Option.isNone(connection) ||
      connection.value.profile === "OWN_CLIENT" ||
      connection.value.accessToken === null
    ) {
      return Option.none<FellowshipLogsConnectionModel>();
    }

    const accessToken = yield* protectedValueStorage.unprotect(
      connection.value.accessToken,
    );

    return Redacted.value(accessToken) === Redacted.value(expectedAccessToken)
      ? connection
      : Option.none<FellowshipLogsConnectionModel>();
  });

  const installConnection = (
    expectedGeneration: FellowshipLogsConnectionGeneration | null,
    connection: Omit<
      FellowshipLogsConnectionModel,
      "createdAt" | "generation" | "id" | "updatedAt"
    >,
  ) =>
    mainDatabase
      .withTransaction(
        E.gen(function* () {
          const current = yield* connectionDAO
            .get()
            .pipe(E.mapError(mapConnectionError("Read")));
          const currentGeneration = Option.match(current, {
            onNone: () => null,
            onSome: (value) => value.generation,
          });

          if (currentGeneration !== expectedGeneration) {
            return yield* new FellowshipLogsConnectionChangedError();
          }

          const generation = yield* crypto
            .randomUUIDv4()
            .pipe(
              E.map(FellowshipLogsConnectionGenerationSchema.make),
              E.mapError(mapConnectionError("Save")),
            );

          yield* connectionDAO
            .save({ ...connection, generation })
            .pipe(
              E.andThen(authorizationTransactionDAO.delete()),
              E.mapError(mapConnectionError("Save")),
            );
        }),
      )
      .pipe(
        withExclusiveLease,
        E.catchTag("SqlError", (cause) => {
          return E.fail(mapConnectionError("Save")(cause));
        }),
        notifyChange,
      );

  const disconnect: FellowshipLogsConnectionShape["disconnect"] = E.fn(
    "FellowshipLogsConnection.disconnect",
  )(function* () {
    return yield* mainDatabase
      .withTransaction(
        authorizationTransactionDAO
          .delete()
          .pipe(E.andThen(connectionDAO.delete())),
      )
      .pipe(
        withExclusiveLease,
        E.mapError(mapConnectionError("Disconnect")),
        notifyChange,
      );
  });

  const getSummary: FellowshipLogsConnectionShape["getSummary"] = E.fn(
    "FellowshipLogsConnection.getSummary",
  )(function* () {
    const connection = yield* connectionDAO
      .get()
      .pipe(E.mapError(mapConnectionError("Read")));

    return Option.map(connection, (value) => {
      return {
        clientId: value.clientId,
        connectedUserId: value.connectedUserId,
        connectedUserName: value.connectedUserName,
        generation: value.generation,
        pointPolicyVersion: value.pointPolicyVersion,
        profile: value.profile,
        status: getStatus(value),
        storageProtection: value.storageProtection,
      };
    });
  });

  const getCredentials: FellowshipLogsConnectionShape["getCredentials"] = E.fn(
    "FellowshipLogsConnection.getCredentials",
  )(function* () {
    const connection = yield* connectionDAO
      .get()
      .pipe(E.mapError(mapConnectionError("Read")));

    return yield* Option.match(connection, {
      onNone: () => E.succeed(Option.none<FellowshipLogsCredentials>()),
      onSome: (value) =>
        unprotectCredentials(value, protectedValueStorage).pipe(E.asSome),
    });
  });

  const saveOwnClient: FellowshipLogsConnectionShape["saveOwnClient"] = E.fn(
    "FellowshipLogsConnection.saveOwnClient",
  )(function* ({
    allowLocalFallback,
    clientId,
    clientSecret,
    expectedGeneration,
  }) {
    const protectedClientSecret = yield* protectedValueStorage
      .protect(clientSecret, { allowLocalFallback })
      .pipe(E.mapError(mapProtectionError));
    const protection = yield* getProtection([protectedClientSecret]);
    const localProtectionAcknowledgedAt =
      yield* getLocalProtectionAcknowledgedAt(protection);

    yield* installConnection(expectedGeneration, {
      accessToken: null,
      accessTokenExpiresAt: null,
      clientId,
      clientSecret: protectedClientSecret,
      connectedUserId: null,
      connectedUserName: null,
      localProtectionAcknowledgedAt,
      pointPolicyVersion: FELLOWSHIP_LOGS_POINT_POLICY_VERSION,
      pointSystemOptInRequiredAt: null,
      profile: "OWN_CLIENT",
      refreshToken: null,
      storageProtection: protection,
    });
  });

  const saveAuthorizedSession: FellowshipLogsConnectionShape["saveAuthorizedSession"] =
    E.fn("FellowshipLogsConnection.saveAuthorizedSession")(function* ({
      accessToken,
      accessTokenExpiresAt,
      allowLocalFallback,
      clientId,
      connectedUserId,
      connectedUserName,
      expectedGeneration,
      profile,
      refreshToken,
    }) {
      const protectedAccessToken = yield* protectedValueStorage
        .protect(accessToken, { allowLocalFallback })
        .pipe(E.mapError(mapProtectionError));
      const protectedRefreshToken =
        refreshToken === null
          ? null
          : yield* protectedValueStorage
              .protect(refreshToken, {
                allowLocalFallback,
              })
              .pipe(E.mapError(mapProtectionError));
      const protectedValues = [
        protectedAccessToken,
        ...(protectedRefreshToken === null ? [] : [protectedRefreshToken]),
      ];
      const protection = yield* getProtection(protectedValues);
      const localProtectionAcknowledgedAt =
        yield* getLocalProtectionAcknowledgedAt(protection);

      return yield* installConnection(expectedGeneration, {
        accessToken: protectedAccessToken,
        accessTokenExpiresAt,
        clientId,
        clientSecret: null,
        connectedUserId,
        connectedUserName,
        localProtectionAcknowledgedAt,
        pointPolicyVersion: FELLOWSHIP_LOGS_POINT_POLICY_VERSION,
        pointSystemOptInRequiredAt: null,
        profile,
        refreshToken: protectedRefreshToken,
        storageProtection: protection,
      });
    });

  const replaceTokens: FellowshipLogsConnectionShape["replaceTokens"] = E.fn(
    "FellowshipLogsConnection.replaceTokens",
  )(function* ({
    accessToken,
    accessTokenExpiresAt,
    expectedAccessToken,
    refreshToken,
  }) {
    const current = yield* connectionDAO
      .get()
      .pipe(E.mapError(mapConnectionError("Read")));
    const allowLocalFallback = Option.exists(
      current,
      (value) => value.storageProtection === "LOCAL_KEY",
    );
    const protectedAccessToken = yield* protectedValueStorage
      .protect(accessToken, { allowLocalFallback })
      .pipe(E.mapError(mapProtectionError));
    const protectedRefreshToken = yield* protectedValueStorage
      .protect(refreshToken, { allowLocalFallback })
      .pipe(E.mapError(mapProtectionError));
    const protection = yield* getProtection([
      protectedAccessToken,
      protectedRefreshToken,
    ]);
    const acknowledgedAt = yield* getLocalProtectionAcknowledgedAt(protection);

    return yield* mainDatabase
      .withTransaction(
        E.gen(function* () {
          const session =
            yield* readSessionWithAccessToken(expectedAccessToken);

          if (Option.isNone(session)) {
            return "SESSION_CHANGED" as const;
          }

          yield* connectionDAO.save({
            ...session.value,
            accessToken: protectedAccessToken,
            accessTokenExpiresAt,
            localProtectionAcknowledgedAt:
              protection === "LOCAL_KEY"
                ? (session.value.localProtectionAcknowledgedAt ??
                  acknowledgedAt)
                : null,
            refreshToken: protectedRefreshToken,
            storageProtection: protection,
          });

          return "UPDATED" as const;
        }),
      )
      .pipe(E.mapError(mapConnectionError("Save")));
  });

  const requireReauthorization: FellowshipLogsConnectionShape["requireReauthorization"] =
    E.fn("FellowshipLogsConnection.requireReauthorization")(function* ({
      expectedAccessToken,
    }) {
      return yield* mainDatabase
        .withTransaction(
          E.gen(function* () {
            const session =
              yield* readSessionWithAccessToken(expectedAccessToken);

            if (Option.isNone(session)) {
              return "SESSION_CHANGED" as const;
            }

            yield* connectionDAO.save({
              ...session.value,
              accessToken: null,
              accessTokenExpiresAt: null,
              refreshToken: null,
            });

            return "UPDATED" as const;
          }),
        )
        .pipe(E.mapError(mapConnectionError("Save")), notifyChange);
    });

  const setPointSystemOptInRequired: FellowshipLogsConnectionShape["setPointSystemOptInRequired"] =
    E.fn("FellowshipLogsConnection.setPointSystemOptInRequired")(function* ({
      connectedUserId,
      required,
    }) {
      return yield* mainDatabase
        .withTransaction(
          E.gen(function* () {
            const current = yield* connectionDAO.get();

            if (
              Option.isNone(current) ||
              current.value.profile !== "FELLOWSHIP_RUN_TRACKER_USER" ||
              current.value.connectedUserId !== connectedUserId
            ) {
              return "SESSION_CHANGED" as const;
            }

            if (
              (current.value.pointSystemOptInRequiredAt !== null) ===
              required
            ) {
              return "UPDATED" as const;
            }

            yield* connectionDAO.save({
              ...current.value,
              pointSystemOptInRequiredAt: required ? yield* DateTime.now : null,
            });

            return "UPDATED" as const;
          }),
        )
        .pipe(E.mapError(mapConnectionError("Save")), notifyChange);
    });

  return {
    changes: SubscriptionRef.changes(revisionRef),
    disconnect,
    getCredentials,
    getSummary,
    replaceTokens,
    requireReauthorization,
    saveAuthorizedSession,
    saveOwnClient,
    setPointSystemOptInRequired,
    withRequestLease,
  } satisfies FellowshipLogsConnectionShape;
});

export class FellowshipLogsConnection extends Context.Service<
  FellowshipLogsConnection,
  FellowshipLogsConnectionShape
>()(
  "@frt/api/services/fellowship-logs-connection/fellowship-logs-connection-service/FellowshipLogsConnection",
) {
  static readonly layerNoDeps = Layer.effect(
    this,
    makeFellowshipLogsConnection,
  );

  static readonly layerWith = (
    protectedValueStorageLayer: Layer.Layer<ProtectedValueStorage>,
  ) =>
    this.layerNoDeps.pipe(
      Layer.provide(FellowshipLogsAuthorizationTransactionDAO.layer),
      Layer.provide(FellowshipLogsConnectionDAO.layer),
      Layer.provide(NodeCrypto.layer),
      Layer.provide(protectedValueStorageLayer),
    );
}
