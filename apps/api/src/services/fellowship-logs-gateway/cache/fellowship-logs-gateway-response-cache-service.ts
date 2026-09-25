import * as Context from "effect/Context";
import type * as DateTime from "effect/DateTime";
import type * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as Option from "effect/Option";
import type * as Schema from "effect/Schema";

import { FellowshipLogsAnalytics } from "@frt/api/services/fellowship-logs-analytics/fellowship-logs-analytics-service.ts";
import { FellowshipLogsResponseDAO } from "@frt/db/daos/fellowship-logs-response/fellowship-logs-response-dao.ts";
import { type FellowshipLogsResponseOperation } from "@frt/db/validation/fellowship-logs-response/fellowship-logs-response-operation-schema.ts";
import { type FellowshipLogsFightId } from "@frt/shared/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { type FellowshipLogsReportCode } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";

import { makeFellowshipLogsGatewayResponseCache } from "./make-fellowship-logs-gateway-response-cache-service.ts";

export type FellowshipLogsGatewayCachedRequest<
  ResponseSchema extends Schema.Codec<unknown, unknown>,
> = {
  readonly fightId: FellowshipLogsFightId | null;
  readonly getExpiresAt: (
    data: ResponseSchema["Type"],
    now: DateTime.Utc,
  ) => Option.Option<DateTime.Utc | null>;
  readonly getReportRevision?: (data: ResponseSchema["Type"]) => number | null;
  readonly key: string;
  readonly operation: FellowshipLogsResponseOperation;
  readonly reportCode: FellowshipLogsReportCode;
  readonly schema: ResponseSchema;
};

export type FellowshipLogsGatewayResponseCacheShape = {
  readonly cached: <
    ResponseSchema extends Schema.Codec<unknown, unknown>,
    Error,
    Requirements,
  >(
    request: FellowshipLogsGatewayCachedRequest<ResponseSchema>,
    fetch: E.Effect<ResponseSchema["Type"], Error, Requirements>,
  ) => E.Effect<ResponseSchema["Type"], Error, Requirements>;
};

export class FellowshipLogsGatewayResponseCache extends Context.Service<
  FellowshipLogsGatewayResponseCache,
  FellowshipLogsGatewayResponseCacheShape
>()(
  "@frt/api/services/fellowship-logs-gateway/cache/fellowship-logs-gateway-response-cache-service/FellowshipLogsGatewayResponseCache",
) {
  static readonly layerNoDeps = Layer.effect(
    this,
    makeFellowshipLogsGatewayResponseCache,
  );

  static readonly layer = this.layerNoDeps.pipe(
    Layer.provide(FellowshipLogsAnalytics.layer),
    Layer.provide(FellowshipLogsResponseDAO.layer),
  );
}
