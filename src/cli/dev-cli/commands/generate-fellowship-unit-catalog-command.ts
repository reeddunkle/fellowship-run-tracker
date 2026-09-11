import * as E from "effect/Effect";
import * as Schema from "effect/Schema";

import { generateFellowshipUnitCatalog } from "@/catalogs/units/generate-fellowship-unit-catalog.ts";
import { NonEmptyStringSchema } from "@/validation/common-schemas.ts";

export const GenerateFellowshipUnitCatalogCommandInputSchema = Schema.Struct({
  inputFilePath: NonEmptyStringSchema,
});

export type GenerateFellowshipUnitCatalogCommandInput =
  typeof GenerateFellowshipUnitCatalogCommandInputSchema.Type;

export const runGenerateFellowshipUnitCatalogCommand = E.fn(
  "dev-cli.generate-fellowship-unit-catalog",
)(function* (input: GenerateFellowshipUnitCatalogCommandInput) {
  yield* generateFellowshipUnitCatalog(input.inputFilePath);

  yield* E.logInfo("Generated Fellowship unit catalog.", {
    inputFilePath: input.inputFilePath,
  });
});
