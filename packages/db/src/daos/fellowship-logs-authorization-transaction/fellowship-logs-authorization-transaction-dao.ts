import * as Context from "effect/Context";
import type * as DateTime from "effect/DateTime";
import type * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as Option from "effect/Option";
import type * as Schema from "effect/Schema";
import type * as SqlError from "effect/sql/SqlError";

import { makeFellowshipLogsAuthorizationTransactionDAO } from "@frt/db/daos/fellowship-logs-authorization-transaction/make-fellowship-logs-authorization-transaction-dao.ts";
import { type FellowshipLogsAuthorizationTransactionModel } from "@frt/db/models/fellowship-logs-authorization-transaction-model.ts";
import { type ProtectedValue } from "@frt/db/validation/encryption/protected-value-schema.ts";
import { type FellowshipLogsClientId } from "@frt/shared/fellowship-logs/fellowship-logs-client-credentials-schema.ts";
import {
  type FellowshipLogsAuthorizedProfile,
  type FellowshipLogsConnectionGeneration,
  type FellowshipLogsOAuthState,
  type FellowshipLogsRedirectUri,
} from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";

type FellowshipLogsAuthorizationTransactionDAOError =
  | Schema.SchemaError
  | SqlError.SqlError;

type FellowshipLogsAuthorizationTransactionDAOValue = {
  readonly clientId: FellowshipLogsClientId;
  readonly createdAt: DateTime.Utc;
  readonly expectedGeneration: FellowshipLogsConnectionGeneration | null;
  readonly expiresAt: DateTime.Utc;
  readonly profile: FellowshipLogsAuthorizedProfile;
  readonly protectedVerifier: ProtectedValue;
  readonly redirectUri: FellowshipLogsRedirectUri;
  readonly state: FellowshipLogsOAuthState;
};

export type FellowshipLogsAuthorizationTransactionDAOShape = {
  readonly delete: () => E.Effect<
    void,
    FellowshipLogsAuthorizationTransactionDAOError
  >;
  readonly deleteExpired: (
    now: DateTime.Utc,
  ) => E.Effect<void, FellowshipLogsAuthorizationTransactionDAOError>;
  readonly get: () => E.Effect<
    Option.Option<FellowshipLogsAuthorizationTransactionModel>,
    FellowshipLogsAuthorizationTransactionDAOError
  >;
  readonly replace: (
    transaction: FellowshipLogsAuthorizationTransactionDAOValue,
  ) => E.Effect<void, FellowshipLogsAuthorizationTransactionDAOError>;
};

export class FellowshipLogsAuthorizationTransactionDAO extends Context.Service<
  FellowshipLogsAuthorizationTransactionDAO,
  FellowshipLogsAuthorizationTransactionDAOShape
>()(
  "@frt/db/daos/fellowship-logs-authorization-transaction/fellowship-logs-authorization-transaction-dao/FellowshipLogsAuthorizationTransactionDAO",
) {
  static readonly layer = Layer.effect(
    this,
    makeFellowshipLogsAuthorizationTransactionDAO,
  );
}
