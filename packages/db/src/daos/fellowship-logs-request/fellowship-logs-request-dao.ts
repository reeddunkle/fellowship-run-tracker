import * as Context from "effect/Context";
import type * as DateTime from "effect/DateTime";
import type * as E from "effect/Effect";
import * as Layer from "effect/Layer";

import { makeFellowshipLogsRequestDAO } from "@frt/db/daos/fellowship-logs-request/make-fellowship-logs-request-dao.ts";
import { type FellowshipLogsRequestDAOError } from "@frt/db/errors/fellowship-logs-request-dao-error.ts";
import {
  type FellowshipLogsRequestOperation,
  type FellowshipLogsRequestSource,
} from "@frt/db/validation/fellowship-logs-request/fellowship-logs-request-schema.ts";

export type FellowshipLogsRequestEvent = {
  readonly occurredAt: DateTime.Utc;
  readonly operation: FellowshipLogsRequestOperation;
  readonly pointsSpent: number | null;
  readonly source: FellowshipLogsRequestSource;
};

type FellowshipLogsRequestSummary = {
  readonly apiRequestCount: number;
  readonly cacheHitCount: number;
  readonly estimatedPointsSaved: number;
  readonly pointsSpent: number;
  readonly trackingSince: DateTime.Utc | null;
};

export type FellowshipLogsRequestDAOShape = {
  readonly getSummary: () => E.Effect<
    FellowshipLogsRequestSummary,
    FellowshipLogsRequestDAOError
  >;

  readonly insertMany: (
    events: ReadonlyArray<FellowshipLogsRequestEvent>,
  ) => E.Effect<void, FellowshipLogsRequestDAOError>;
};

export class FellowshipLogsRequestDAO extends Context.Service<
  FellowshipLogsRequestDAO,
  FellowshipLogsRequestDAOShape
>()(
  "@frt/db/daos/fellowship-logs-request/fellowship-logs-request-dao/FellowshipLogsRequestDAO",
) {
  static readonly layer = Layer.effect(this, makeFellowshipLogsRequestDAO);
}
