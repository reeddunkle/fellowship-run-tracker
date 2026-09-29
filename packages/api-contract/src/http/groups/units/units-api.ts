import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiError from "effect/http-api/HttpApiError";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";
import * as Schema from "effect/Schema";

import {
  UnitApiUnitListSchema,
  UnitApiUnitSchema,
} from "@frt/shared/unit/unit-api-schema.ts";
import { NonEmptyStringSchema } from "@frt/shared/util/common-schemas.ts";

const UNITS_ROUTE = "/units" as const;

const UnitIdParamsSchema = Schema.Struct({
  id: NonEmptyStringSchema,
});

const GetUnitsEndpoint = HttpApiEndpoint.get("getUnits", UNITS_ROUTE, {
  error: HttpApiError.InternalServerErrorNoContent,
  success: UnitApiUnitListSchema,
});

const GetUnitEndpoint = HttpApiEndpoint.get("getUnit", `${UNITS_ROUTE}/:id`, {
  error: [
    HttpApiError.NotFoundNoContent,
    HttpApiError.InternalServerErrorNoContent,
  ],
  params: UnitIdParamsSchema,
  success: UnitApiUnitSchema,
});

export const UnitsApi = HttpApiGroup.make("units").add(
  GetUnitsEndpoint,
  GetUnitEndpoint,
);
