import * as E from "effect/Effect";
import type * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError";

import { UnitApiService } from "@frt/api/services/api/unit/unit-api-service.ts";
import { AppHttpApi } from "@frt/api-contract/http/http-api.ts";
import { type UnitDAOError } from "@frt/db/daos/unit/unit-dao.ts";

function mapUnitApiError(
  error: UnitDAOError,
): E.Effect<never, HttpApiError.InternalServerError> {
  return E.gen(function* () {
    yield* E.logError("Unit API operation failed.", {
      error,
    });

    return yield* new HttpApiError.InternalServerError();
  });
}

const UnitsApiHandlersInferred = HttpApiBuilder.group(
  AppHttpApi,
  "units",
  E.fn(function* (handlers) {
    const unitApiService = yield* UnitApiService;

    return handlers
      .handle("getUnits", () => {
        return unitApiService.getAll().pipe(E.catch(mapUnitApiError));
      })
      .handle("getUnit", ({ params }) => {
        return E.gen(function* () {
          const unit = yield* unitApiService
            .getById({
              id: params.id,
            })
            .pipe(E.catch(mapUnitApiError));

          if (Option.isNone(unit)) {
            return yield* new HttpApiError.NotFound();
          }

          return unit.value;
        });
      });
  }),
);

export const UnitsApiLayer: Layer.Layer<
  Layer.Success<typeof UnitsApiHandlersInferred>,
  Layer.Error<typeof UnitsApiHandlersInferred>,
  UnitApiService
> = UnitsApiHandlersInferred;
