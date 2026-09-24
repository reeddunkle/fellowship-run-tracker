import * as E from "effect/Effect";
import * as Command from "effect/unstable/cli/Command";
import * as Flag from "effect/unstable/cli/Flag";

import { generateFellowshipUnitCatalog } from "@frt/cli/catalogs/generate-fellowship-unit-catalog.ts";
import { NonEmptyStringSchema } from "@frt/shared/util/common-schemas.ts";

const runGenerateUnitCatalogCommand = E.fn("cli.generate-unit-catalog")(
  function* ({ inputFilePath }: { readonly inputFilePath: string }) {
    yield* generateFellowshipUnitCatalog(inputFilePath);

    yield* E.logInfo("Generated Fellowship unit catalog.", {
      inputFilePath,
    });
  },
);

export const generateUnitCatalogCommand = Command.make(
  "generate-unit-catalog",
  {
    inputFilePath: Flag.string("input").pipe(
      Flag.withAlias("i"),
      Flag.withSchema(NonEmptyStringSchema),
      Flag.withDescription("External mob data JSON to generate from."),
    ),
  },
  runGenerateUnitCatalogCommand,
).pipe(
  Command.withDescription(
    "Regenerate the bundled Fellowship unit catalog from external mob data.",
  ),
);
