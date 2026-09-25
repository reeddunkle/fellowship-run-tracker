import * as Context from "effect/Context";
import type * as E from "effect/Effect";
import * as Layer from "effect/Layer";

import {
  FellowshipLogsRequestDAO,
  type FellowshipLogsRequestEvent,
} from "@frt/db/daos/fellowship-logs-request/fellowship-logs-request-dao.ts";
import { type FellowshipLogsRequestDAOError } from "@frt/db/errors/fellowship-logs-request-dao-error.ts";
import { type FellowshipLogsApiAnalyticsSummary } from "@frt/shared/fellowship-logs/fellowship-logs-api-schema.ts";

import { makeFellowshipLogsAnalytics } from "./make-fellowship-logs-analytics-service.ts";

type RecordFellowshipLogsRequestOptions = Omit<
  FellowshipLogsRequestEvent,
  "occurredAt"
>;

export type FellowshipLogsAnalyticsShape = {
  readonly getSummary: () => E.Effect<
    FellowshipLogsApiAnalyticsSummary,
    FellowshipLogsRequestDAOError
  >;

  readonly record: (
    options: RecordFellowshipLogsRequestOptions,
  ) => E.Effect<void>;
};

export class FellowshipLogsAnalytics extends Context.Service<
  FellowshipLogsAnalytics,
  FellowshipLogsAnalyticsShape
>()(
  "@frt/api/services/fellowship-logs-analytics/fellowship-logs-analytics-service/FellowshipLogsAnalytics",
) {
  static readonly layerNoDeps = Layer.effect(this, makeFellowshipLogsAnalytics);

  static readonly layer = this.layerNoDeps.pipe(
    Layer.provide(FellowshipLogsRequestDAO.layer),
  );
}
