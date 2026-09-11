import * as Schema from "effect/Schema";
import * as HttpApiEndpoint from "effect/unstable/httpapi/HttpApiEndpoint";
import * as HttpApiError from "effect/unstable/httpapi/HttpApiError";
import * as HttpApiGroup from "effect/unstable/httpapi/HttpApiGroup";
import * as HttpApiSchema from "effect/unstable/httpapi/HttpApiSchema";

import {
  ConfigurationApiConfigurationListSchema,
  ConfigurationApiConfigurationSchema,
  DeleteConfigurationsByDungeonAndLevelApiRequestSchema,
  SaveConfigurationApiRequestSchema,
} from "@/services/api/configuration/configuration-api-schema.ts";
import { ConfigurationIdSchema } from "@/validation/configuration/configuration-id-schema.ts";

const CONFIGURATIONS_ROUTE = "/configurations" as const;

const ConfigurationIdParamsSchema = Schema.Struct({
  id: ConfigurationIdSchema,
});

const SavedConfigurationSchema = ConfigurationApiConfigurationSchema.pipe(
  HttpApiSchema.status(201),
);

const GetConfigurationsEndpoint = HttpApiEndpoint.get(
  "getConfigurations",
  CONFIGURATIONS_ROUTE,
  {
    error: HttpApiError.InternalServerErrorNoContent,
    success: ConfigurationApiConfigurationListSchema,
  },
);

const GetConfigurationEndpoint = HttpApiEndpoint.get(
  "getConfiguration",
  `${CONFIGURATIONS_ROUTE}/:id`,
  {
    error: [
      HttpApiError.NotFoundNoContent,
      HttpApiError.InternalServerErrorNoContent,
    ],
    params: ConfigurationIdParamsSchema,
    success: ConfigurationApiConfigurationSchema,
  },
);

const SaveConfigurationEndpoint = HttpApiEndpoint.post(
  "saveConfiguration",
  CONFIGURATIONS_ROUTE,
  {
    error: HttpApiError.InternalServerErrorNoContent,
    payload: SaveConfigurationApiRequestSchema,
    success: SavedConfigurationSchema,
  },
);

const SaveReplacingDungeonAndLevelEndpoint = HttpApiEndpoint.post(
  "saveReplacingDungeonAndLevel",
  `${CONFIGURATIONS_ROUTE}/replace`,
  {
    error: HttpApiError.InternalServerErrorNoContent,
    payload: SaveConfigurationApiRequestSchema,
    success: SavedConfigurationSchema,
  },
);

const UpdateConfigurationEndpoint = HttpApiEndpoint.put(
  "updateConfiguration",
  `${CONFIGURATIONS_ROUTE}/:id`,
  {
    error: HttpApiError.InternalServerErrorNoContent,
    params: ConfigurationIdParamsSchema,
    payload: SaveConfigurationApiRequestSchema,
    success: ConfigurationApiConfigurationSchema,
  },
);

const DeleteConfigurationEndpoint = HttpApiEndpoint.delete(
  "deleteConfiguration",
  `${CONFIGURATIONS_ROUTE}/:id`,
  {
    error: HttpApiError.InternalServerErrorNoContent,
    params: ConfigurationIdParamsSchema,
  },
);

const DeleteConfigurationsByDungeonAndLevelEndpoint = HttpApiEndpoint.delete(
  "deleteConfigurationsByDungeonAndLevel",
  `${CONFIGURATIONS_ROUTE}/dungeon-level`,
  {
    error: HttpApiError.InternalServerErrorNoContent,
    payload: DeleteConfigurationsByDungeonAndLevelApiRequestSchema,
  },
);

export const ConfigurationsApi = HttpApiGroup.make("configurations").add(
  GetConfigurationsEndpoint,
  GetConfigurationEndpoint,
  SaveConfigurationEndpoint,
  SaveReplacingDungeonAndLevelEndpoint,
  UpdateConfigurationEndpoint,
  DeleteConfigurationEndpoint,
  DeleteConfigurationsByDungeonAndLevelEndpoint,
);
