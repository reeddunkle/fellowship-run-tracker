import * as Schema from "effect/Schema";

import { HostSchema, PortSchema } from "@frt/shared/util/common-schemas.ts";

export const PublicApiHostSchema = HostSchema.pipe(
  Schema.brand("PublicApiHost"),
);

export const PublicApiPortSchema = PortSchema.pipe(
  Schema.brand("PublicApiPort"),
);
