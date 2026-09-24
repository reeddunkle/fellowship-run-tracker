import * as Context from "effect/Context";
import type * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as Option from "effect/Option";
import type * as Schema from "effect/Schema";
import type * as SqlError from "effect/unstable/sql/SqlError";

import { makeFellowshipLogsCredentialDAO } from "@frt/db/daos/fellowship-logs-credential/make-fellowship-logs-credential-dao.ts";
import { type FellowshipLogsCredentialModel } from "@frt/db/models/fellowship-logs-credential-model.ts";
import { type EncryptedValue } from "@frt/db/validation/encryption/encrypted-value-schema.ts";
import { type FellowshipLogsClientId } from "@frt/shared/app-settings/app-settings-schema.ts";

export type FellowshipLogsCredentialDAOError =
  | SqlError.SqlError
  | Schema.SchemaError;

type FellowshipLogsCredentialDAOValue = {
  readonly clientId: FellowshipLogsClientId | null;
  readonly clientSecret: EncryptedValue | null;
};

export type FellowshipLogsCredentialDAOShape = {
  readonly get: () => E.Effect<
    Option.Option<FellowshipLogsCredentialModel>,
    FellowshipLogsCredentialDAOError
  >;

  readonly insert: (
    credential: FellowshipLogsCredentialDAOValue,
  ) => E.Effect<void, FellowshipLogsCredentialDAOError>;

  readonly update: (
    credential: FellowshipLogsCredentialDAOValue,
  ) => E.Effect<void, FellowshipLogsCredentialDAOError>;
};

export class FellowshipLogsCredentialDAO extends Context.Service<
  FellowshipLogsCredentialDAO,
  FellowshipLogsCredentialDAOShape
>()(
  "@frt/db/daos/fellowship-logs-credential/fellowship-logs-credential-dao/FellowshipLogsCredentialDAO",
) {
  static readonly layer = Layer.effect(this, makeFellowshipLogsCredentialDAO);
}
