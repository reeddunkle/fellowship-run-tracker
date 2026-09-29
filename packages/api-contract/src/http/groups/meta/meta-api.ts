import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";

import { MetaApiMetaSchema } from "@frt/shared/meta/meta-api-schema.ts";

const META_ROUTE = "/meta" as const;

const GetMetaEndpoint = HttpApiEndpoint.get("getMeta", META_ROUTE, {
  success: MetaApiMetaSchema,
});

export const MetaApi = HttpApiGroup.make("meta").add(GetMetaEndpoint);
