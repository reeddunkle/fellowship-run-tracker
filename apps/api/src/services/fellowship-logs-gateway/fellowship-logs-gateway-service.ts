import * as Context from "effect/Context";
import type * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as Schema from "effect/Schema";
import type * as Stream from "effect/Stream";

import { appConfig } from "@frt/api/app-config.ts";
import {
  type FellowshipLogsGatewayEventDecodeError,
  type FellowshipLogsGatewayGraphQLResponseError,
  type FellowshipLogsGatewayRateLimitExceededError,
  type FellowshipLogsGatewayRateLimitRejectedError,
  type FellowshipLogsGatewayReportChangedError,
  type FellowshipLogsGatewayRequestError,
} from "@frt/api/errors/fellowship-logs-gateway-error.ts";
import {
  NodeHttpClientLayer,
  NodePlatformLayer,
} from "@frt/api/layers/node-platform-layer.ts";
import { AppSettingsStore } from "@frt/api/services/app-settings-store/app-settings-store-service.ts";
import { FellowshipLogsGatewayResponseCache } from "@frt/api/services/fellowship-logs-gateway/cache/fellowship-logs-gateway-response-cache-service.ts";
import { type DungeonId } from "@frt/shared/fellowship/validation/fellowship-common.ts";
import { type FellowshipEvent } from "@frt/shared/fellowship/validation/fellowship-event-schema.ts";
import { type FellowshipLogsFightId } from "@frt/shared/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { type FellowshipLogsRateLimitSnapshot } from "@frt/shared/fellowship-logs/fellowship-logs-rate-limit-schema.ts";
import { type FellowshipLogsReportCode } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";

import { FELLOWSHIP_LOGS_FIXTURE_DIRECTORY } from "./fellowship-logs-gateway-fixture-paths.ts";
import { makeFellowshipLogsGatewayFixture } from "./make-fellowship-logs-gateway-fixture.ts";
import { makeFellowshipLogsGateway } from "./make-fellowship-logs-gateway-service.ts";
import {
  type FellowshipLogsGatewayGraphQLRequestSchema,
  type FellowshipLogsGatewayGraphQLResponse,
} from "./validation/fellowship-logs-gateway-graphql-schema.ts";
import { type FellowshipLogsGatewayAccessToken } from "./validation/fellowship-logs-gateway-oauth-schema.ts";
import { type FellowshipLogsGatewayReport } from "./validation/fellowship-logs-gateway-report-schema.ts";

export type FellowshipLogsGatewayCredentials = {
  readonly clientId: string;
  readonly clientSecret: string;
};

export type CachedAccessToken = FellowshipLogsGatewayCredentials & {
  readonly accessToken: FellowshipLogsGatewayAccessToken;
  readonly expiresAtMilliseconds: number;
};

export type GetCredentials = () => E.Effect<
  FellowshipLogsGatewayCredentials,
  FellowshipLogsGatewayRequestError
>;

export type Query = <ResponseData>(
  request: typeof FellowshipLogsGatewayGraphQLRequestSchema.Type,
  responseSchema: Schema.Decoder<ResponseData, never>,
) => E.Effect<
  FellowshipLogsGatewayGraphQLResponse<ResponseData>,
  | FellowshipLogsGatewayRateLimitRejectedError
  | FellowshipLogsGatewayRequestError
>;

export type GetFellowshipLogsGatewayReportOptions = {
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
};

export type FellowshipLogsGatewayRequestOperationError =
  | FellowshipLogsGatewayGraphQLResponseError
  | FellowshipLogsGatewayRateLimitExceededError
  | FellowshipLogsGatewayReportChangedError
  | FellowshipLogsGatewayRequestError;

type FellowshipLogsGatewayError =
  | FellowshipLogsGatewayEventDecodeError
  | FellowshipLogsGatewayRequestOperationError;

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

  readonly getReport: (
    options: GetFellowshipLogsGatewayReportOptions,
  ) => E.Effect<
    FellowshipLogsGatewayReport,
    FellowshipLogsGatewayRequestOperationError
  >;

  readonly streamReportPages: (
    options: StreamFellowshipLogsReportOptions,
  ) => Stream.Stream<
    FellowshipLogsGatewayReport,
    FellowshipLogsGatewayRequestOperationError
  >;

  readonly streamEvents: (
    options: StreamFellowshipLogsReportOptions,
  ) => Stream.Stream<FellowshipEvent, FellowshipLogsGatewayError>;
};

export class FellowshipLogsGateway extends Context.Service<
  FellowshipLogsGateway,
  FellowshipLogsGatewayShape
>()(
  "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-service/FellowshipLogsGateway",
) {
  static readonly layerNoDeps = Layer.effect(this, makeFellowshipLogsGateway);

  static readonly liveLayer = this.layerNoDeps.pipe(
    Layer.provide(AppSettingsStore.layer),
    Layer.provide(FellowshipLogsGatewayResponseCache.layer),
    Layer.provide(NodeHttpClientLayer),
  );

  static readonly fixtureLayer = Layer.effect(
    this,
    makeFellowshipLogsGatewayFixture({
      fixtureDirectory: FELLOWSHIP_LOGS_FIXTURE_DIRECTORY,
    }),
  ).pipe(Layer.provide(NodePlatformLayer));

  static readonly layer = Layer.unwrap(
    E.gen(function* () {
      const useFixtures = yield* appConfig.fellowshipLogsUseFixtures;

      return useFixtures
        ? FellowshipLogsGateway.fixtureLayer
        : FellowshipLogsGateway.liveLayer;
    }),
  );
}
