import * as Schema from "effect/Schema";

import { FilePathSchema, HostSchema, PortSchema } from "./common-schemas.ts";

export const ElectronRendererHostSchema = HostSchema.pipe(
  Schema.brand("ElectronRendererHost"),
);

export const ElectronRendererPortSchema = Schema.FiniteFromString.pipe(
  Schema.decodeTo(PortSchema),
  Schema.brand("ElectronRendererPort"),
);

export const DatabaseFilenameSchema = FilePathSchema.pipe(
  Schema.brand("DatabaseFilename"),
);

export const RawEnvSchema = Schema.Struct({
  DATABASE_FILENAME: DatabaseFilenameSchema,
  ELECTRON_RENDERER_HOST: ElectronRendererHostSchema,
  ELECTRON_RENDERER_PORT: ElectronRendererPortSchema,
});
