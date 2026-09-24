import * as Schema from "effect/Schema";

import { HostSchema, PortSchema } from "@frt/shared/util/common-schemas.ts";

export const ElectronRendererHostSchema = HostSchema.pipe(
  Schema.brand("ElectronRendererHost"),
);

export type ElectronRendererHost = typeof ElectronRendererHostSchema.Type;

export const ElectronRendererPortSchema = Schema.FiniteFromString.pipe(
  Schema.decodeTo(PortSchema),
  Schema.brand("ElectronRendererPort"),
);

export type ElectronRendererPort = typeof ElectronRendererPortSchema.Type;
