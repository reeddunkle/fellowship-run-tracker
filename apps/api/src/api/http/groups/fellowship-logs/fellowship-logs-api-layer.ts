import * as E from "effect/Effect";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as HttpApiError from "effect/http-api/HttpApiError";
import type * as Layer from "effect/Layer";
import * as Match from "effect/Match";

import {
  type FellowshipLogsGatewayApiError,
  mapFellowshipLogsGatewayApiError,
} from "@frt/api/api/http/groups/fellowship-logs/map-fellowship-logs-gateway-api-error.ts";
import {
  type FellowshipLogsConnectionError,
  type FellowshipLogsNotConnectedError,
} from "@frt/api/errors/fellowship-logs-connection-error.ts";
import {
  FellowshipLogs,
  type QueueFellowshipLogsDungeonRunImportError,
  type ResumeImportJobWithCurrentConnectionError,
} from "@frt/api/services/fellowship-logs/fellowship-logs-service.ts";
import { type FellowshipLogsGatewayRequestOperationError } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-service.ts";
import {
  FellowshipLogsApiAlreadyImportedError,
  FellowshipLogsApiConnectionRequiredError,
  FellowshipLogsApiDungeonLevelNotFoundError,
  FellowshipLogsApiReportAccessDeniedError,
  FellowshipLogsApiRunNotFoundError,
} from "@frt/api-contract/errors/fellowship-logs-api-error.ts";
import { AppHttpApi } from "@frt/api-contract/http/http-api.ts";
import { type DungeonRunDAOError } from "@frt/db/errors/dungeon-run-dao-error.ts";
import { type DungeonRunStoreError } from "@frt/db/stores/dungeon-run/dungeon-run-store.ts";
import { type FellowshipLogsApiDungeonRunReference } from "@frt/shared/fellowship-logs/fellowship-logs-api-schema.ts";

function mapFellowshipLogsMetadataApiError({
  fightId,
  reportCode,
}: FellowshipLogsApiDungeonRunReference) {
  return (
    error:
      | FellowshipLogsConnectionError
      | FellowshipLogsGatewayRequestOperationError
      | FellowshipLogsNotConnectedError,
  ): E.Effect<
    never,
    | FellowshipLogsApiConnectionRequiredError
    | FellowshipLogsApiDungeonLevelNotFoundError
    | FellowshipLogsApiReportAccessDeniedError
    | FellowshipLogsApiRunNotFoundError
    | FellowshipLogsGatewayApiError
    | HttpApiError.InternalServerError
  > => {
    if (error._tag === "FellowshipLogsNotConnectedError") {
      return E.fail(
        new FellowshipLogsApiConnectionRequiredError({
          reason: "NOT_CONNECTED",
        }),
      );
    }

    if (error._tag === "FellowshipLogsConnectionError") {
      return logInternalServerError(error);
    }

    if (
      error._tag === "FellowshipLogsGatewayGraphQLResponseError" &&
      error.reason === "FightMissingDifficultyLevel"
    ) {
      return E.fail(
        new FellowshipLogsApiDungeonLevelNotFoundError({ fightId, reportCode }),
      );
    }

    if (
      error._tag === "FellowshipLogsGatewayGraphQLResponseError" &&
      error.reason === "ErrorsReturned" &&
      error.errors.some(({ message }) => {
        return /permission to view this report/iu.test(message);
      })
    ) {
      return E.fail(
        new FellowshipLogsApiReportAccessDeniedError({
          fightId,
          reportCode,
        }),
      );
    }

    if (
      error._tag === "FellowshipLogsGatewayGraphQLResponseError" &&
      (error.reason === "FightNotFound" || error.reason === "ReportNotFound")
    ) {
      return E.fail(
        new FellowshipLogsApiRunNotFoundError({ fightId, reportCode }),
      );
    }

    return mapFellowshipLogsGatewayApiError(error);
  };
}

function mapQueueFellowshipLogsDungeonRunImportError(
  error: QueueFellowshipLogsDungeonRunImportError,
): E.Effect<
  never,
  | FellowshipLogsApiAlreadyImportedError
  | FellowshipLogsApiConnectionRequiredError
  | HttpApiError.InternalServerError
> {
  if (error._tag === "FellowshipLogsDungeonRunImportAlreadyImportedError") {
    return E.fail(
      new FellowshipLogsApiAlreadyImportedError({
        dungeonRunId: error.dungeonRunId,
        fightId: error.fightId,
        reportCode: error.reportCode,
      }),
    );
  }

  if (error._tag === "FellowshipLogsNotConnectedError") {
    return E.fail(
      new FellowshipLogsApiConnectionRequiredError({ reason: "NOT_CONNECTED" }),
    );
  }

  return logInternalServerError(error);
}

const logInternalServerError: (
  error: unknown,
) => E.Effect<never, HttpApiError.InternalServerError> = E.fnUntraced(
  function* (error) {
    yield* E.logError("Fellowship Logs API operation failed.", {
      error,
    });

    return yield* new HttpApiError.InternalServerError();
  },
);

const mapGetFellowshipLogsDungeonRunsError: (
  error: DungeonRunStoreError,
) => E.Effect<never, HttpApiError.InternalServerError> = E.fnUntraced(
  function* (error) {
    yield* E.logError("Failed to list imported Fellowship Logs runs.", {
      error,
    });

    return yield* new HttpApiError.InternalServerError();
  },
);

function mapDeleteFellowshipLogsDungeonRunError(
  error: DungeonRunDAOError,
): E.Effect<never, HttpApiError.InternalServerError | HttpApiError.NotFound> {
  if (error.reason._tag === "DungeonRunNotFoundError") {
    return E.fail(new HttpApiError.NotFound());
  }

  return E.gen(function* () {
    yield* E.logError("Failed to delete imported Fellowship Logs run.", {
      error,
    });

    return yield* new HttpApiError.InternalServerError();
  });
}

function mapResumeImportJobWithCurrentConnectionError(
  error: ResumeImportJobWithCurrentConnectionError,
): E.Effect<
  never,
  | FellowshipLogsApiConnectionRequiredError
  | HttpApiError.InternalServerError
  | HttpApiError.NotFound
> {
  return Match.value(error).pipe(
    Match.tagsExhaustive({
      BackgroundJobQueueError: logInternalServerError,
      BackgroundJobQueueNotFoundError: () =>
        E.fail(new HttpApiError.NotFound()),
      FellowshipLogsConnectionError: logInternalServerError,
      FellowshipLogsNotConnectedError: () =>
        E.fail(
          new FellowshipLogsApiConnectionRequiredError({
            reason: "NOT_CONNECTED",
          }),
        ),
    }),
  );
}

const FellowshipLogsApiHandlersInferred = HttpApiBuilder.group(
  AppHttpApi,
  "fellowshipLogs",
  E.fnUntraced(function* (handlers) {
    const fellowshipLogs = yield* FellowshipLogs;

    return handlers
      .handle("getFellowshipLogsDungeonRunMetadata", ({ payload }) => {
        return fellowshipLogs
          .getDungeonRunMetadata(payload)
          .pipe(E.catch(mapFellowshipLogsMetadataApiError(payload)));
      })
      .handle("getFellowshipLogsRateLimitData", () => {
        return fellowshipLogs
          .getRateLimitData()
          .pipe(E.catch(mapFellowshipLogsGatewayApiError));
      })
      .handle("getFellowshipLogsPointPools", () => {
        return fellowshipLogs
          .getPointPools()
          .pipe(E.catch(logInternalServerError));
      })
      .handle("getFellowshipLogsImportCostEstimate", () => {
        return fellowshipLogs.getImportCostEstimate();
      })
      .handle("queueFellowshipLogsDungeonRunImport", ({ payload }) => {
        return fellowshipLogs
          .queueDungeonRunImport(payload)
          .pipe(E.catch(mapQueueFellowshipLogsDungeonRunImportError));
      })
      .handle(
        "resumeFellowshipLogsImportJobWithCurrentConnection",
        ({ params }) => {
          return fellowshipLogs
            .resumeImportJobWithCurrentConnection({ jobId: params.jobId })
            .pipe(E.catch(mapResumeImportJobWithCurrentConnectionError));
        },
      )
      .handle("getFellowshipLogsDungeonRuns", () => {
        return fellowshipLogs
          .getImportedDungeonRuns()
          .pipe(E.catch(mapGetFellowshipLogsDungeonRunsError));
      })
      .handle("deleteFellowshipLogsDungeonRun", ({ params }) => {
        return fellowshipLogs
          .deleteImportedDungeonRun({
            dungeonRunId: params.dungeonRunId,
          })
          .pipe(E.catch(mapDeleteFellowshipLogsDungeonRunError));
      })
      .handle("getFellowshipLogsAnalytics", () => {
        return fellowshipLogs
          .getAnalyticsSummary()
          .pipe(E.catch(logInternalServerError));
      });
  }),
);

export const FellowshipLogsApiLayer: Layer.Layer<
  Layer.Success<typeof FellowshipLogsApiHandlersInferred>,
  Layer.Error<typeof FellowshipLogsApiHandlersInferred>,
  FellowshipLogs
> = FellowshipLogsApiHandlersInferred;
