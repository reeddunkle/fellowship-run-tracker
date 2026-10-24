import * as Context from "effect/Context";
import type * as DateTime from "effect/DateTime";
import type * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as Option from "effect/Option";
import type * as Schema from "effect/Schema";
import type * as SqlError from "effect/sql/SqlError";

import { makeFellowshipLogsConnectionDAO } from "@frt/db/daos/fellowship-logs-connection/make-fellowship-logs-connection-dao.ts";
import { type FellowshipLogsConnectionModel } from "@frt/db/models/fellowship-logs-connection-model.ts";
import { type ProtectedValue } from "@frt/db/validation/encryption/protected-value-schema.ts";
import { type FellowshipLogsClientId } from "@frt/shared/fellowship-logs/fellowship-logs-client-credentials-schema.ts";
import {
  type FellowshipLogsConnectedUserId,
  type FellowshipLogsConnectedUserName,
  type FellowshipLogsConnectionGeneration,
  type FellowshipLogsConnectionProfile,
  type FellowshipLogsPointPolicyVersion,
  type FellowshipLogsStorageProtection,
} from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";

type FellowshipLogsConnectionDAOError = Schema.SchemaError | SqlError.SqlError;

type FellowshipLogsConnectionDAOValue = {
  readonly accessToken: ProtectedValue | null;
  readonly accessTokenExpiresAt: DateTime.Utc | null;
  readonly clientId: FellowshipLogsClientId;
  readonly clientSecret: ProtectedValue | null;
  readonly connectedUserId: FellowshipLogsConnectedUserId | null;
  readonly connectedUserName: FellowshipLogsConnectedUserName | null;
  readonly generation: FellowshipLogsConnectionGeneration;
  readonly localProtectionAcknowledgedAt: DateTime.Utc | null;
  readonly pointPolicyVersion: FellowshipLogsPointPolicyVersion;
  readonly pointSystemOptInRequiredAt: DateTime.Utc | null;
  readonly profile: FellowshipLogsConnectionProfile;
  readonly refreshToken: ProtectedValue | null;
  readonly storageProtection: FellowshipLogsStorageProtection;
};

export type FellowshipLogsConnectionDAOShape = {
  readonly delete: () => E.Effect<void, FellowshipLogsConnectionDAOError>;
  readonly get: () => E.Effect<
    Option.Option<FellowshipLogsConnectionModel>,
    FellowshipLogsConnectionDAOError
  >;
  readonly save: (
    connection: FellowshipLogsConnectionDAOValue,
  ) => E.Effect<void, FellowshipLogsConnectionDAOError>;
};

export class FellowshipLogsConnectionDAO extends Context.Service<
  FellowshipLogsConnectionDAO,
  FellowshipLogsConnectionDAOShape
>()(
  "@frt/db/daos/fellowship-logs-connection/fellowship-logs-connection-dao/FellowshipLogsConnectionDAO",
) {
  static readonly layer = Layer.effect(this, makeFellowshipLogsConnectionDAO);
}
