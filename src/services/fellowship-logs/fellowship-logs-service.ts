import * as Context from "effect/Context";
import type * as DateTime from "effect/DateTime";
import type * as E from "effect/Effect";
import type * as Schema from "effect/Schema";
import type * as Stream from "effect/Stream";

import {
  type FellowshipLogsEventDecodeError,
  type FellowshipLogsGraphQLResponseError,
  type FellowshipLogsRequestError,
} from "@/errors/fellowship-logs-error.ts";
import { type DungeonId } from "@/services/fellowship/validation/fellowship-common.ts";
import { type FellowshipEvent } from "@/services/fellowship/validation/fellowship-event-schema.ts";
import { type FellowshipLogsFightId } from "@/validation/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { type FellowshipLogsReportCode } from "@/validation/fellowship-logs/fellowship-logs-report-code-schema.ts";

import {
  type FellowshipLogsGraphQLRequestSchema,
  type FellowshipLogsGraphQLResponse,
} from "./validation/fellowship-logs-graphql-schema.ts";
import { type FellowshipLogsAccessToken } from "./validation/fellowship-logs-oauth-schema.ts";
import { type FellowshipLogsRateLimitData } from "./validation/fellowship-logs-rate-limit-schema.ts";
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
  FellowshipLogsRequestError
>;

export type GetFellowshipLogsReportOptions = {
  readonly fightId: FellowshipLogsFightId;
  readonly reportCode: FellowshipLogsReportCode;
};

export type FellowshipLogsDungeonRunMetadata = {
  readonly dungeonId: DungeonId;
  readonly dungeonLevel: number;
  readonly endedAt: DateTime.Utc;
  readonly startedAt: DateTime.Utc;
};

export type FellowshipLogsRequestOperationError =
  | FellowshipLogsGraphQLResponseError
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
    FellowshipLogsRateLimitData | null,
    FellowshipLogsRequestOperationError
  >;

  readonly getReport: (
    options: GetFellowshipLogsReportOptions,
  ) => E.Effect<FellowshipLogsReport, FellowshipLogsRequestOperationError>;

  readonly streamReportPages: (
    options: GetFellowshipLogsReportOptions,
  ) => Stream.Stream<FellowshipLogsReport, FellowshipLogsRequestOperationError>;

  readonly streamEvents: (
    options: GetFellowshipLogsReportOptions,
  ) => Stream.Stream<FellowshipEvent, FellowshipLogsError>;
};

export class FellowshipLogs extends Context.Service<
  FellowshipLogs,
  FellowshipLogsService
>()(
  "fellowship-run-tracker/services/fellowship-logs/fellowship-logs-service/FellowshipLogs",
) {}
