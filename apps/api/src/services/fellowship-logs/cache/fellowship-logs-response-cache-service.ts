import * as Context from "effect/Context";
import type * as DateTime from "effect/DateTime";
import type * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as Option from "effect/Option";
import type * as Schema from "effect/Schema";

import { FellowshipLogsResponseDAO } from "@frt/db/daos/fellowship-logs-response/fellowship-logs-response-dao.ts";
import { type FellowshipLogsResponseOperation } from "@frt/db/validation/fellowship-logs-response/fellowship-logs-response-operation-schema.ts";
import { type FellowshipLogsFightId } from "@frt/shared/validation/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { type FellowshipLogsReportCode } from "@frt/shared/validation/fellowship-logs/fellowship-logs-report-code-schema.ts";

import { makeFellowshipLogsResponseCache } from "./make-fellowship-logs-response-cache.ts";

export type FellowshipLogsCachedRequest<
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

export type FellowshipLogsResponseCacheShape = {
  readonly cached: <
    ResponseSchema extends Schema.Codec<unknown, unknown>,
    Error,
    Requirements,
  >(
    request: FellowshipLogsCachedRequest<ResponseSchema>,
    fetch: E.Effect<ResponseSchema["Type"], Error, Requirements>,
  ) => E.Effect<ResponseSchema["Type"], Error, Requirements>;
};

export class FellowshipLogsResponseCache extends Context.Service<
  FellowshipLogsResponseCache,
  FellowshipLogsResponseCacheShape
>()(
  "@frt/api/services/fellowship-logs/cache/fellowship-logs-response-cache-service/FellowshipLogsResponseCache",
) {
  static readonly layerNoDeps = Layer.effect(
    this,
    makeFellowshipLogsResponseCache,
  );

  static readonly layer = this.layerNoDeps.pipe(
    Layer.provide(FellowshipLogsResponseDAO.layer),
  );
}
