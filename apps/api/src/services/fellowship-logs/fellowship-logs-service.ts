import * as Context from "effect/Context";
import type * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as Schema from "effect/Schema";
import type * as Stream from "effect/Stream";

import { appConfig } from "@frt/api/app-config.ts";
import {
  type FellowshipLogsEventDecodeError,
  type FellowshipLogsGraphQLResponseError,
  type FellowshipLogsRateLimitExceededError,
  type FellowshipLogsRateLimitRejectedError,
  type FellowshipLogsReportChangedError,
  type FellowshipLogsRequestError,
} from "@frt/api/errors/fellowship-logs-error.ts";
import {
  NodeHttpClientLayer,
  NodePlatformLayer,
} from "@frt/api/layers/node-platform-layer.ts";
import { AppSettings } from "@frt/api/services/app-settings/app-settings-service.ts";
import { FellowshipLogsResponseCache } from "@frt/api/services/fellowship-logs/cache/fellowship-logs-response-cache-service.ts";
import { type DungeonId } from "@frt/shared/fellowship/validation/fellowship-common.ts";
import { type FellowshipEvent } from "@frt/shared/fellowship/validation/fellowship-event-schema.ts";
import { type FellowshipLogsRateLimitSnapshot } from "@frt/shared/fellowship-logs/validation/fellowship-logs-rate-limit-schema.ts";
import { type FellowshipLogsFightId } from "@frt/shared/validation/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { type FellowshipLogsReportCode } from "@frt/shared/validation/fellowship-logs/fellowship-logs-report-code-schema.ts";

import { FELLOWSHIP_LOGS_FIXTURE_DIRECTORY } from "./fellowship-logs-fixture-paths.ts";
import { makeFellowshipLogs } from "./make-fellowship-logs.ts";
import { makeFellowshipLogsFixture } from "./make-fellowship-logs-fixture.ts";
import {
  type FellowshipLogsGraphQLRequestSchema,
  type FellowshipLogsGraphQLResponse,
} from "./validation/fellowship-logs-graphql-schema.ts";
import { type FellowshipLogsAccessToken } from "./validation/fellowship-logs-oauth-schema.ts";
import { type FellowshipLogsReport } from "./validation/fellowship-logs-report-schema.ts";

export type FellowshipLogsCredentials = {
  readonly clientId: string;
  readonly clientSecret: string;
};

export type CachedAccessToken = FellowshipLogsCredentials & {
  readonly accessToken: FellowshipLogsAccessToken;
  readonly expiresAtMilliseconds: number;
};

export type GetCredentials = () => E.Effect<
  FellowshipLogsCredentials,
  FellowshipLogsRequestError
>;

export type Query = <ResponseData>(
  request: typeof FellowshipLogsGraphQLRequestSchema.Type,
  responseSchema: Schema.Decoder<ResponseData, never>,
) => E.Effect<
  FellowshipLogsGraphQLResponse<ResponseData>,
  FellowshipLogsRateLimitRejectedError | FellowshipLogsRequestError
>;

export type GetFellowshipLogsReportOptions = {
  readonly fightId: FellowshipLogsFightId;
  readonly reportCode: FellowshipLogsReportCode;
};

type StreamFellowshipLogsReportOptions = GetFellowshipLogsReportOptions & {
  readonly onProgress?: (fraction: number) => E.Effect<void>;
};

export type FellowshipLogsDungeonRunMetadata = {
  readonly dungeonId: DungeonId;
  readonly dungeonLevel: number;
  readonly endedAt: DateTime.Utc;
  readonly isInProgress: boolean;
  readonly startedAt: DateTime.Utc;
};

export type FellowshipLogsRequestOperationError =
  | FellowshipLogsGraphQLResponseError
  | FellowshipLogsRateLimitExceededError
  | FellowshipLogsReportChangedError
  | FellowshipLogsRequestError;

type FellowshipLogsError =
  | FellowshipLogsEventDecodeError
  | FellowshipLogsRequestOperationError;

type GetRateLimitDataOptions = {
  readonly force?: boolean;
};

export type FellowshipLogsService = {
  readonly getDungeonRunMetadata: (
    options: GetFellowshipLogsReportOptions,
  ) => E.Effect<
    FellowshipLogsDungeonRunMetadata,
    FellowshipLogsRequestOperationError
  >;

  readonly getRateLimitData: (
    options?: GetRateLimitDataOptions,
  ) => E.Effect<
    FellowshipLogsRateLimitSnapshot | null,
    FellowshipLogsRequestOperationError
  >;

  readonly getReport: (
    options: GetFellowshipLogsReportOptions,
  ) => E.Effect<FellowshipLogsReport, FellowshipLogsRequestOperationError>;

  readonly streamReportPages: (
    options: StreamFellowshipLogsReportOptions,
  ) => Stream.Stream<FellowshipLogsReport, FellowshipLogsRequestOperationError>;

  readonly streamEvents: (
    options: StreamFellowshipLogsReportOptions,
  ) => Stream.Stream<FellowshipEvent, FellowshipLogsError>;
};

export class FellowshipLogs extends Context.Service<
  FellowshipLogs,
  FellowshipLogsService
>()(
  "@frt/api/services/fellowship-logs/fellowship-logs-service/FellowshipLogs",
) {
  static readonly layerNoDeps = Layer.effect(this, makeFellowshipLogs);

  static readonly liveLayer = this.layerNoDeps.pipe(
    Layer.provide(AppSettings.layer),
    Layer.provide(FellowshipLogsResponseCache.layer),
    Layer.provide(NodeHttpClientLayer),
  );

  static readonly fixtureLayer = Layer.effect(
    this,
    makeFellowshipLogsFixture({
      fixtureDirectory: FELLOWSHIP_LOGS_FIXTURE_DIRECTORY,
    }),
  ).pipe(Layer.provide(NodePlatformLayer));

  static readonly layer = Layer.unwrap(
    E.gen(function* () {
      const useFixtures = yield* appConfig.fellowshipLogsUseFixtures;

      return useFixtures
        ? FellowshipLogs.fixtureLayer
        : FellowshipLogs.liveLayer;
    }),
  );
}
