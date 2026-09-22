import * as Schema from "effect/Schema";

import { FilePathSchema } from "@frt/shared/validation/common-schemas.ts";

export const DatabaseFilenameSchema = FilePathSchema.pipe(
  Schema.brand("DatabaseFilename"),
);
