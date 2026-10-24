import * as Context from "effect/Context";
import type * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as Stream from "effect/Stream";

import { appConfig } from "@frt/api/app-config.ts";
import {
  type FellowshipLogsGatewayAccessError,
  type FellowshipLogsGatewayGraphQLResponseError,
  type FellowshipLogsGatewayPointPolicyError,
  type FellowshipLogsGatewayRateLimitExceededError,
  type FellowshipLogsGatewayReportChangedError,
  type FellowshipLogsGatewayRequestError,
} from "@frt/api/errors/fellowship-logs-gateway-error.ts";
import {
  NodeHttpClientLayer,
  NodePlatformLayer,
} from "@frt/api/layers/node-platform-layer.ts";
import { FellowshipLogsAnalytics } from "@frt/api/services/fellowship-logs-analytics/fellowship-logs-analytics-service.ts";
import { FellowshipLogsGatewayResponseCache } from "@frt/api/services/fellowship-logs-gateway/cache/fellowship-logs-gateway-response-cache-service.ts";
import { type FellowshipLogsGatewayWorkflowCost } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-points-spent.ts";
import { FellowshipLogsGatewayRequestPacer } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-request-pacer.ts";
import { type DungeonId } from "@frt/shared/fellowship/validation/fellowship-common.ts";
import { type FellowshipLogsFightId } from "@frt/shared/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { type FellowshipLogsRateLimitSnapshot } from "@frt/shared/fellowship-logs/fellowship-logs-rate-limit-schema.ts";
import { type FellowshipLogsReportCode } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";

import { makeFellowshipLogsGatewayFileQuery } from "./fellowship-logs-gateway-file-query.ts";
import { FELLOWSHIP_LOGS_FIXTURE_DIRECTORY } from "./fellowship-logs-gateway-fixture-paths.ts";
import {
  makeFellowshipLogsGateway,
  makeFellowshipLogsGatewayFromQuery,
} from "./make-fellowship-logs-gateway-service.ts";
import { type FellowshipLogsGatewayReport } from "./validation/fellowship-logs-gateway-report-schema.ts";

type GetFellowshipLogsGatewayReportOptions = {
  readonly fightId: FellowshipLogsFightId;
  readonly reportCode: FellowshipLogsReportCode;
};

type StreamFellowshipLogsReportOptions =
  GetFellowshipLogsGatewayReportOptions & {
    readonly onProgress?: (fraction: number) => E.Effect<void>;
  };

export type FellowshipLogsGatewayDungeonRunMetadata = {
  readonly dungeonId: DungeonId;
  readonly dungeonLevel: number;
  readonly endedAt: DateTime.Utc;
  readonly isInProgress: boolean;
  readonly startedAt: DateTime.Utc;
  readonly workflowCost: FellowshipLogsGatewayWorkflowCost;
};

export type FellowshipLogsGatewayRequestOperationError =
  | FellowshipLogsGatewayAccessError
  | FellowshipLogsGatewayGraphQLResponseError
  | FellowshipLogsGatewayPointPolicyError
  | FellowshipLogsGatewayRateLimitExceededError
  | FellowshipLogsGatewayReportChangedError
  | FellowshipLogsGatewayRequestError;

type GetRateLimitDataOptions = {
  readonly force?: boolean;
};

export type FellowshipLogsGatewayShape = {
  readonly getDungeonRunMetadata: (
    options: GetFellowshipLogsGatewayReportOptions,
  ) => E.Effect<
    FellowshipLogsGatewayDungeonRunMetadata,
    FellowshipLogsGatewayRequestOperationError
  >;

  readonly getRateLimitData: (
    options?: GetRateLimitDataOptions,
  ) => E.Effect<
    FellowshipLogsRateLimitSnapshot | null,
    FellowshipLogsGatewayRequestOperationError
  >;

  readonly streamReportPages: (
    options: StreamFellowshipLogsReportOptions,
  ) => Stream.Stream<
    FellowshipLogsGatewayReport,
    FellowshipLogsGatewayRequestOperationError
  >;
};

export class FellowshipLogsGateway extends Context.Service<
  FellowshipLogsGateway,
  FellowshipLogsGatewayShape
>()(
  "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-service/FellowshipLogsGateway",
) {
  static readonly layerNoDeps = Layer.effect(this, makeFellowshipLogsGateway);

  static readonly liveLayer = this.layerNoDeps.pipe(
    Layer.provide(FellowshipLogsAnalytics.layer),
    Layer.provide(FellowshipLogsGatewayResponseCache.layer),
    Layer.provide(FellowshipLogsGatewayRequestPacer.layer),
    Layer.provide(NodeHttpClientLayer),
  );

  static readonly fixtureLayer = Layer.effect(
    this,
    makeFellowshipLogsGatewayFileQuery({
      fixtureDirectory: FELLOWSHIP_LOGS_FIXTURE_DIRECTORY,
    }).pipe(E.flatMap(makeFellowshipLogsGatewayFromQuery)),
  ).pipe(
    Layer.provide(FellowshipLogsAnalytics.layer),
    Layer.provide(FellowshipLogsGatewayResponseCache.layer),
    Layer.provide(NodePlatformLayer),
  );

  static readonly layer = Layer.unwrap(
    E.gen(function* () {
      const useFixtures = yield* appConfig.fellowshipLogsUseFixtures;

      return useFixtures
        ? FellowshipLogsGateway.fixtureLayer
        : FellowshipLogsGateway.liveLayer;
    }),
  );
}
