import * as E from "effect/Effect";
import type * as Layer from "effect/Layer";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError";

import { type ImportFellowshipLogsDungeonRunError } from "@frt/api/application/fellowship-logs-dungeon-run-importer/fellowship-logs-dungeon-run-importer-service.ts";
import {
  type FellowshipLogsGraphQLResponseError,
  type FellowshipLogsRequestError,
} from "@frt/api/errors/fellowship-logs-error.ts";
import { FellowshipLogsApiService } from "@frt/api/services/api/fellowship-logs/fellowship-logs-api-service.ts";
import { type DungeonRunRepositoryError } from "@frt/api/services/dungeon-run-repository/dungeon-run-repository-service.ts";
import { type FellowshipLogsRequestOperationError } from "@frt/api/services/fellowship-logs/fellowship-logs-service.ts";
import {
  FellowshipLogsApiDungeonLevelNotFoundError,
  FellowshipLogsApiRunNotFinishedError,
  FellowshipLogsApiRunNotFoundError,
} from "@frt/api-contract/errors/fellowship-logs-api-error.ts";
import { AppHttpApi } from "@frt/api-contract/http/http-api.ts";
import { type DungeonRunDAOError } from "@frt/db/errors/dungeon-run-dao-error.ts";
import { type FellowshipLogsApiDungeonRunReference } from "@frt/shared/fellowship-logs/fellowship-logs-api-schema.ts";

type FellowshipLogsApiError =
  | FellowshipLogsRequestError
  | FellowshipLogsGraphQLResponseError
  | ImportFellowshipLogsDungeonRunError;

/**
 * Maps failures for the requested run to the wire errors the client can act
 * on; anything else is logged and becomes a 500.
 */
function mapFellowshipLogsApiError({
  fightId,
  reportCode,
}: FellowshipLogsApiDungeonRunReference) {
  return (
    error: FellowshipLogsApiError,
  ): E.Effect<
    never,
    | FellowshipLogsApiDungeonLevelNotFoundError
    | FellowshipLogsApiRunNotFinishedError
    | FellowshipLogsApiRunNotFoundError
    | HttpApiError.InternalServerError
  > => {
    const run = { fightId, reportCode };

    if (error._tag === "FellowshipLogsDungeonRunImportRunNotFoundError") {
      return E.fail(new FellowshipLogsApiRunNotFoundError(run));
    }

    if (error._tag === "FellowshipLogsDungeonRunImportRunNotFinishedError") {
      return E.fail(new FellowshipLogsApiRunNotFinishedError(run));
    }

    // The same missing data, found while importing or while looking up the
    // run's metadata beforehand.
    if (
      error._tag ===
        "FellowshipLogsDungeonRunImportDungeonLevelNotFoundError" ||
      (error._tag === "FellowshipLogsGraphQLResponseError" &&
        error.reason === "FightMissingDifficultyLevel")
    ) {
      return E.fail(new FellowshipLogsApiDungeonLevelNotFoundError(run));
    }

    return logInternalServerError(error);
  };
}

function logInternalServerError(
  error: FellowshipLogsApiError,
): E.Effect<never, HttpApiError.InternalServerError> {
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

const FellowshipLogsApiHandlersInferred = HttpApiBuilder.group(
  AppHttpApi,
  "fellowshipLogs",
  E.fn(function* (handlers) {
    const fellowshipLogsApiService = yield* FellowshipLogsApiService;

    return handlers
      .handle("getFellowshipLogsDungeonRunMetadata", ({ payload }) => {
        return fellowshipLogsApiService
          .getDungeonRunMetadata(payload)
          .pipe(E.catch(mapFellowshipLogsApiError(payload)));
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
          .pipe(E.catch(mapFellowshipLogsApiError(payload)));
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
