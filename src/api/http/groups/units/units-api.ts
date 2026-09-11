import * as Schema from "effect/Schema";
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint";
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";

import {
  UnitApiUnitListSchema,
  UnitApiUnitSchema,
} from "@/services/api/unit/unit-api-schema.ts";
import { NonEmptyStringSchema } from "@/validation/common-schemas.ts";

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
