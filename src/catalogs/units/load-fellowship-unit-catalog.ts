import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Schema from "effect/Schema";

import { FellowshipUnitCatalogSchema } from "@/catalogs/units/fellowship-unit-catalog-schema.ts";
import { FellowshipUnitCatalogJsonParseError } from "@/errors/fellowship-unit-catalog-error.ts";
import { parseJson } from "@/util/parse-json.ts";

const FELLOWSHIP_UNIT_CATALOG_FILE_PATH =
  "./src/catalogs/units/fellowship-unit-catalog.json";

export const loadFellowshipUnitCatalog = E.fn("load-fellowship-unit-catalog")(
  function* () {
    const fileSystem = yield* FileSystem.FileSystem;

    const contents = yield* fileSystem.readFileString(
      FELLOWSHIP_UNIT_CATALOG_FILE_PATH,
    );

    const json = yield* parseJson({
      contents,
      onError: (cause) => {
        return new FellowshipUnitCatalogJsonParseError({
          cause,
          filePath: FELLOWSHIP_UNIT_CATALOG_FILE_PATH,
        });
      },
    });

    return yield* Schema.decodeUnknownEffect(FellowshipUnitCatalogSchema)(json);
  },
);
