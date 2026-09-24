import * as Context from "effect/Context";
import type * as DateTime from "effect/DateTime";
import type * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as Option from "effect/Option";

import { makeFellowshipLogsResponseDAO } from "@frt/db/daos/fellowship-logs-response/make-fellowship-logs-response-dao.ts";
import { type FellowshipLogsResponseDAOError } from "@frt/db/errors/fellowship-logs-response-dao-error.ts";
import { type FellowshipLogsResponseModel } from "@frt/db/models/fellowship-logs-response-model.ts";
import { type FellowshipLogsResponseOperation } from "@frt/db/validation/fellowship-logs-response/fellowship-logs-response-operation-schema.ts";
import { type FellowshipLogsFightId } from "@frt/shared/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { type FellowshipLogsReportCode } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";

type FellowshipLogsResponseKeyOptions = {
  readonly key: string;
};

type PutFellowshipLogsResponseOptions = FellowshipLogsResponseKeyOptions & {
  readonly body: Uint8Array;
  readonly expiresAt: DateTime.Utc | null;
  readonly fightId: FellowshipLogsFightId | null;
  readonly operation: FellowshipLogsResponseOperation;
  readonly reportCode: FellowshipLogsReportCode;
  readonly reportRevision: number | null;
};

type DeleteFellowshipLogsResponsesForReportOptions = {
  readonly reportCode: FellowshipLogsReportCode;
};

type EvictFellowshipLogsResponsesToSizeOptions = {
  readonly maxBytes: number;
};

export type FellowshipLogsResponseDAOShape = {
  readonly delete: (
    options: FellowshipLogsResponseKeyOptions,
  ) => E.Effect<void, FellowshipLogsResponseDAOError>;

  readonly deleteExpired: () => E.Effect<
    number,
    FellowshipLogsResponseDAOError
  >;

  readonly deleteForReport: (
    options: DeleteFellowshipLogsResponsesForReportOptions,
  ) => E.Effect<number, FellowshipLogsResponseDAOError>;

  readonly evictToSize: (
    options: EvictFellowshipLogsResponsesToSizeOptions,
  ) => E.Effect<number, FellowshipLogsResponseDAOError>;

  readonly get: (
    options: FellowshipLogsResponseKeyOptions,
  ) => E.Effect<
    Option.Option<FellowshipLogsResponseModel>,
    FellowshipLogsResponseDAOError
  >;

  readonly incrementalVacuum: () => E.Effect<
    void,
    FellowshipLogsResponseDAOError
  >;

  readonly put: (
    options: PutFellowshipLogsResponseOptions,
  ) => E.Effect<void, FellowshipLogsResponseDAOError>;

  readonly touch: (
    options: FellowshipLogsResponseKeyOptions,
  ) => E.Effect<void, FellowshipLogsResponseDAOError>;
};

export class FellowshipLogsResponseDAO extends Context.Service<
  FellowshipLogsResponseDAO,
  FellowshipLogsResponseDAOShape
>()(
  "@frt/db/daos/fellowship-logs-response/fellowship-logs-response-dao/FellowshipLogsResponseDAO",
) {
  static readonly layer = Layer.effect(this, makeFellowshipLogsResponseDAO);
}
