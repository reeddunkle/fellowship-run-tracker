import * as SchemaJITCompiler from "effect/schema/SchemaJITCompiler";

import { FellowshipLogHeaderSchema } from "@frt/api/services/fellowship/validation/fellowship-header-schema.ts";
import { fellowshipEventSchemas } from "@frt/shared/fellowship/validation/fellowship-event-schema.ts";

export function enableFellowshipEventSchemaJit(): void {
  const schemas = [
    FellowshipLogHeaderSchema,
    ...Object.values(fellowshipEventSchemas),
  ];

  schemas.forEach((schema) => {
    // @effect-diagnostics-next-line unstableApiUsage:off
    SchemaJITCompiler.enable(schema.ast);
  });
}
