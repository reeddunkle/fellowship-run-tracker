import * as E from "effect/Effect";
import type * as Layer from "effect/Layer";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError";

import { AppHttpApi } from "@/api/http/http-api.ts";
import { type ImportFellowshipLogsDungeonRunError } from "@/application/fellowship-logs-dungeon-run-importer/fellowship-logs-dungeon-run-importer-service.ts";
import { type DungeonRunDAOError } from "@/errors/dungeon-run-dao-error.ts";
import {
  FellowshipLogsApiRunNotFinishedError,
  FellowshipLogsApiRunNotFoundError,
  FellowshipLogsDungeonRunImportRunNotFinishedError,
  FellowshipLogsDungeonRunImportRunNotFoundError,
} from "@/errors/fellowship-logs-dungeon-run-import-error.ts";
import {
  type FellowshipLogsGraphQLResponseError,
  type FellowshipLogsRequestError,
} from "@/errors/fellowship-logs-error.ts";
import { FellowshipLogsApiService } from "@/services/api/fellowship-logs/fellowship-logs-api-service.ts";
import { type DungeonRunRepositoryError } from "@/services/dungeon-run-repository/dungeon-run-repository-service.ts";
import { type FellowshipLogsRequestOperationError } from "@/services/fellowship-logs/fellowship-logs-service.ts";

type FellowshipLogsApiError =
  | FellowshipLogsRequestError
  | FellowshipLogsGraphQLResponseError
  | ImportFellowshipLogsDungeonRunError;

function mapFellowshipLogsApiError(
  error: FellowshipLogsApiError,
): E.Effect<
  never,
  | FellowshipLogsApiRunNotFinishedError
  | FellowshipLogsApiRunNotFoundError
  | HttpApiError.InternalServerError
> {
  if (error instanceof FellowshipLogsDungeonRunImportRunNotFoundError) {
    return E.fail(
      new FellowshipLogsApiRunNotFoundError({
        fightId: error.fightId,
        message: "We couldn't find that report and fight.",
        reportCode: error.reportCode,
      }),
    );
  }

  if (error instanceof FellowshipLogsDungeonRunImportRunNotFinishedError) {
    return E.fail(
      new FellowshipLogsApiRunNotFinishedError({
        fightId: error.fightId,
        message: "This run hasn't finished yet.",
        reportCode: error.reportCode,
      }),
    );
  }

  return E.gen(function* () {
    yield* E.logError("Fellowship Logs API operation failed.", {
      error,
    });

    return yield* new HttpApiError.InternalServerError();
  });
}

function mapFellowshipLogsRateLimitApiError(
  error: FellowshipLogsRequestOperationError,
): E.Effect<never, HttpApiError.InternalServerError> {
  return E.gen(function* () {
    yield* E.logError("Fellowship Logs API operation failed.", {
      error,
    });

    return yield* new HttpApiError.InternalServerError();
  });
}

function mapGetFellowshipLogsDungeonRunsError(
  error: DungeonRunRepositoryError,
): E.Effect<never, HttpApiError.InternalServerError> {
  return E.gen(function* () {
    yield* E.logError("Failed to list imported Fellowship Logs runs.", {
      error,
    });

    return yield* new HttpApiError.InternalServerError();
  });
}

function mapDeleteFellowshipLogsDungeonRunError(
  error: DungeonRunDAOError,
): E.Effect<never, HttpApiError.InternalServerError | HttpApiError.NotFound> {
  if (error.details._tag === "RunNotFound") {
    return E.fail(new HttpApiError.NotFound());
  }

  return E.gen(function* () {
    yield* E.logError("Failed to delete imported Fellowship Logs run.", {
      error,
    });

    return yield* new HttpApiError.InternalServerError();
  });
}

const FellowshipLogsApiHandlersInferred = HttpApiBuilder.group(
  AppHttpApi,
  "fellowshipLogs",
  E.fn(function* (handlers) {
    const fellowshipLogsApiService = yield* FellowshipLogsApiService;

    return handlers
      .handle("getFellowshipLogsDungeonRunMetadata", ({ payload }) => {
        return fellowshipLogsApiService
          .getDungeonRunMetadata(payload)
          .pipe(E.catch(mapFellowshipLogsApiError));
      })
      .handle("getFellowshipLogsRateLimitData", () => {
        return fellowshipLogsApiService
          .getRateLimitData()
          .pipe(E.catch(mapFellowshipLogsRateLimitApiError));
      })
      .handle("getFellowshipLogsLastKnownRateLimitData", () => {
        return fellowshipLogsApiService
          .getLastKnownRateLimitData()
          .pipe(E.catch(mapFellowshipLogsRateLimitApiError));
      })
      .handle("importFellowshipLogsDungeonRun", ({ payload }) => {
        return fellowshipLogsApiService
          .importDungeonRun(payload)
          .pipe(E.catch(mapFellowshipLogsApiError));
      })
      .handle("getFellowshipLogsDungeonRuns", () => {
        return fellowshipLogsApiService
          .getImportedDungeonRuns()
          .pipe(E.catch(mapGetFellowshipLogsDungeonRunsError));
      })
      .handle("deleteFellowshipLogsDungeonRun", ({ params }) => {
        return fellowshipLogsApiService
          .deleteImportedDungeonRun({
            dungeonRunId: params.dungeonRunId,
          })
          .pipe(E.catch(mapDeleteFellowshipLogsDungeonRunError));
      });
  }),
);

export const FellowshipLogsApiLayer: Layer.Layer<
  Layer.Success<typeof FellowshipLogsApiHandlersInferred>,
  Layer.Error<typeof FellowshipLogsApiHandlersInferred>,
  FellowshipLogsApiService
> = FellowshipLogsApiHandlersInferred;
