import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { describe, expect, test } from "vitest";

import { FellowshipLogsAuthorizationTransactionDAO } from "@frt/db/daos/fellowship-logs-authorization-transaction/fellowship-logs-authorization-transaction-dao.ts";
import { FellowshipLogsConnectionDAO } from "@frt/db/daos/fellowship-logs-connection/fellowship-logs-connection-dao.ts";
import { makeMainDatabaseLayer } from "@frt/db/databases/main-database.ts";
import { runTest } from "@frt/db/tests/common/run-test.ts";
import { EncryptedValueSchema } from "@frt/db/validation/encryption/encrypted-value-schema.ts";
import { ProtectedValueSchema } from "@frt/db/validation/encryption/protected-value-schema.ts";
import { FellowshipLogsClientIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-client-credentials-schema.ts";
import {
  FELLOWSHIP_LOGS_POINT_POLICY_VERSION,
  FellowshipLogsConnectionGenerationSchema,
  FellowshipLogsOAuthStateSchema,
  FellowshipLogsRedirectUriSchema,
} from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";

const CLIENT_ID = Schema.decodeSync(FellowshipLogsClientIdSchema)("client-id");
const OTHER_CLIENT_ID = Schema.decodeSync(FellowshipLogsClientIdSchema)(
  "other-client-id",
);
const GENERATION = Schema.decodeSync(FellowshipLogsConnectionGenerationSchema)(
  "7c3f4a1e-2b5d-4c8e-9f60-1a2b3c4d5e6f",
);
const OTHER_GENERATION = Schema.decodeSync(
  FellowshipLogsConnectionGenerationSchema,
)("0d9e8f7a-6b5c-4d3e-a2f1-0e9d8c7b6a5f");
const OAUTH_STATE = Schema.decodeSync(FellowshipLogsOAuthStateSchema)("state");
const REDIRECT_URI = Schema.decodeSync(FellowshipLogsRedirectUriSchema)(
  "https://auth.example.com/oauth/callback",
);

const ENCRYPTED_VALUE = Schema.encodeSync(EncryptedValueSchema)({
  algorithm: "AES-256-GCM",
  ciphertext: "ciphertext",
  iv: "initialization-vector",
  version: 1,
});

const PROTECTED_VALUE = Schema.encodeSync(ProtectedValueSchema)({
  protection: "LOCAL_KEY",
  value: ENCRYPTED_VALUE,
  version: 1,
});

const PersistenceTestLayer = Layer.mergeAll(
  FellowshipLogsAuthorizationTransactionDAO.layer,
  FellowshipLogsConnectionDAO.layer,
).pipe(Layer.provideMerge(makeMainDatabaseLayer(":memory:")));

describe("FellowshipLogsConnectionDAO", () => {
  test("saves, replaces and deletes the active connection", async () => {
    const result = await E.gen(function* () {
      const connectionDAO = yield* FellowshipLogsConnectionDAO;
      const acknowledgedAt = DateTime.makeUnsafe("2026-10-24T12:00:00Z");

      yield* connectionDAO.save({
        accessToken: null,
        accessTokenExpiresAt: null,
        clientId: CLIENT_ID,
        clientSecret: PROTECTED_VALUE,
        connectedUserId: null,
        connectedUserName: null,
        generation: GENERATION,
        localProtectionAcknowledgedAt: acknowledgedAt,
        pointPolicyVersion: FELLOWSHIP_LOGS_POINT_POLICY_VERSION,
        pointSystemOptInRequiredAt: null,
        profile: "OWN_CLIENT",
        refreshToken: null,
        storageProtection: "LOCAL_KEY",
      });

      const first = Option.getOrThrow(yield* connectionDAO.get());

      yield* connectionDAO.save({
        accessToken: PROTECTED_VALUE,
        accessTokenExpiresAt: DateTime.makeUnsafe("2026-10-24T13:00:00Z"),
        clientId: OTHER_CLIENT_ID,
        clientSecret: null,
        connectedUserId: null,
        connectedUserName: null,
        generation: OTHER_GENERATION,
        localProtectionAcknowledgedAt: acknowledgedAt,
        pointPolicyVersion: FELLOWSHIP_LOGS_POINT_POLICY_VERSION,
        pointSystemOptInRequiredAt: null,
        profile: "OWN_CLIENT_USER",
        refreshToken: null,
        storageProtection: "LOCAL_KEY",
      });

      const second = Option.getOrThrow(yield* connectionDAO.get());

      yield* connectionDAO.delete();

      return {
        deleted: Option.isNone(yield* connectionDAO.get()),
        first,
        second,
      };
    }).pipe(E.provide(PersistenceTestLayer), runTest);

    expect(result.first).toMatchObject({
      clientId: "client-id",
      clientSecret: PROTECTED_VALUE,
      generation: GENERATION,
      profile: "OWN_CLIENT",
      storageProtection: "LOCAL_KEY",
    });
    expect(result.second).toMatchObject({
      accessToken: PROTECTED_VALUE,
      clientId: "other-client-id",
      clientSecret: null,
      generation: OTHER_GENERATION,
      profile: "OWN_CLIENT_USER",
    });
    expect(result.deleted).toBe(true);
  });

  test("stores a point-system opt-in requirement only for the recommended profile", async () => {
    const requiredAt = DateTime.makeUnsafe("2026-10-24T12:30:00Z");
    const connection = {
      accessToken: PROTECTED_VALUE,
      accessTokenExpiresAt: DateTime.makeUnsafe("2026-10-24T13:00:00Z"),
      clientId: CLIENT_ID,
      clientSecret: null,
      connectedUserId: null,
      connectedUserName: null,
      generation: GENERATION,
      localProtectionAcknowledgedAt: DateTime.makeUnsafe(
        "2026-10-24T12:00:00Z",
      ),
      pointPolicyVersion: FELLOWSHIP_LOGS_POINT_POLICY_VERSION,
      pointSystemOptInRequiredAt: requiredAt,
      refreshToken: null,
      storageProtection: "LOCAL_KEY",
    } as const;

    const result = await E.gen(function* () {
      const connectionDAO = yield* FellowshipLogsConnectionDAO;

      yield* connectionDAO.save({
        ...connection,
        profile: "FELLOWSHIP_RUN_TRACKER_USER",
      });

      const stored = Option.getOrThrow(yield* connectionDAO.get());
      const ownClientUserError = yield* connectionDAO
        .save({ ...connection, profile: "OWN_CLIENT_USER" })
        .pipe(E.flip);

      return { ownClientUserError, stored };
    }).pipe(E.provide(PersistenceTestLayer), runTest);

    expect(result.stored.pointSystemOptInRequiredAt).toEqual(requiredAt);
    expect(result.ownClientUserError._tag).toBe("SqlError");
  });
});

describe("FellowshipLogsAuthorizationTransactionDAO", () => {
  test("keeps only the latest pending authorization", async () => {
    const result = await E.gen(function* () {
      const transactionDAO = yield* FellowshipLogsAuthorizationTransactionDAO;
      const createdAt = DateTime.makeUnsafe("2026-10-24T12:00:00Z");
      const expiresAt = DateTime.makeUnsafe("2026-10-24T12:10:00Z");

      yield* transactionDAO.replace({
        clientId: CLIENT_ID,
        createdAt,
        expectedGeneration: null,
        expiresAt,
        profile: "FELLOWSHIP_RUN_TRACKER_USER",
        protectedVerifier: PROTECTED_VALUE,
        redirectUri: REDIRECT_URI,
        state: OAUTH_STATE,
      });

      yield* transactionDAO.replace({
        clientId: OTHER_CLIENT_ID,
        createdAt,
        expectedGeneration: null,
        expiresAt,
        profile: "OWN_CLIENT_USER",
        protectedVerifier: PROTECTED_VALUE,
        redirectUri: REDIRECT_URI,
        state: OAUTH_STATE,
      });

      const current = Option.getOrThrow(yield* transactionDAO.get());

      yield* transactionDAO.delete();

      return {
        current,
        deleted: Option.isNone(yield* transactionDAO.get()),
      };
    }).pipe(E.provide(PersistenceTestLayer), runTest);

    expect(result.current).toMatchObject({
      clientId: "other-client-id",
      profile: "OWN_CLIENT_USER",
      protectedVerifier: PROTECTED_VALUE,
    });
    expect(result.deleted).toBe(true);
  });
});
