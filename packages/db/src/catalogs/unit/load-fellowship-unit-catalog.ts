import * as E from "effect/Effect";
import * as Schema from "effect/Schema";

import { FellowshipUnitCatalogSchema } from "@frt/db/catalogs/unit/fellowship-unit-catalog-schema.ts";

// [KEEP] Imported rather than read from disk so the catalog is bundled into the
// Electron main build, where this module no longer sits next to the JSON file.
import fellowshipUnitCatalogJson from "./fellowship-unit-catalog.json" with {
  type: "json",
};

export const loadFellowshipUnitCatalog = E.fn("load-fellowship-unit-catalog")(
  function* () {
    return yield* Schema.decodeUnknownEffect(FellowshipUnitCatalogSchema)(
      fellowshipUnitCatalogJson,
    );
  },
);
