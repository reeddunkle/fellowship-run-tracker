import * as A from "effect/Array";
import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Order from "effect/Order";
import * as Schema from "effect/Schema";

import { fixWithBiome } from "@frt/api/helpers/fix-with-biome.ts";
import {
  type ExternalMobData,
  ExternalMobDataSchema,
} from "@frt/cli/catalogs/external-mob-data-schema.ts";
import { FellowshipUnitCatalogJsonParseError } from "@frt/cli/errors/fellowship-unit-catalog-error.ts";
import { FELLOWSHIP_UNIT_CATALOG_FILE_PATH } from "@frt/db/catalogs/catalog-paths.ts";
import {
  type FellowshipUnitCatalog,
  FellowshipUnitCatalogSchema,
} from "@frt/db/catalogs/unit/fellowship-unit-catalog-schema.ts";
import { parseJson } from "@frt/shared/util/parse-json.ts";

const OUTPUT_FILE_PATH = FELLOWSHIP_UNIT_CATALOG_FILE_PATH;

type FellowshipUnitCatalogEntry = FellowshipUnitCatalog[number];

type UnitCatalogOverride = Partial<Omit<FellowshipUnitCatalogEntry, "id">>;

const UNIT_CATALOG_OVERRIDES: Readonly<Record<string, UnitCatalogOverride>> = {
  "276": {
    groupKey: "CHICKEN",
    name: "Chicken",
    variant: "Small",
  },
  "277": {
    groupKey: "CHICKEN",
    name: "Chicken",
    variant: "Medium",
  },
  "278": {
    groupKey: "CHICKEN",
    name: "Chicken",
    variant: "Large",
  },
  "280": {
    status: "ACTIVE",
  },
  "282": {
    status: "INACTIVE",
  },
  "283": {
    status: "INACTIVE",
  },
  "284": {
    status: "INACTIVE",
  },
};

const NumericStringOrder = Order.mapInput(Order.Number, (value: string) =>
  Number(value),
);

const UnitCatalogEntryOrder = Order.mapInput(
  NumericStringOrder,
  (entry: FellowshipUnitCatalogEntry) => entry.id,
);

function createUnitCatalogEntry({
  id,
  mob,
}: {
  readonly id: string;
  readonly mob: ExternalMobData[string];
}): FellowshipUnitCatalogEntry {
  const dungeonIds = Array.from(
    new Set(
      mob.FoundInZoneGameIDs.map((dungeonId) => {
        return String(dungeonId);
      }),
    ),
  );

  const defaultEntry = {
    dungeonIds: A.sort(dungeonIds, NumericStringOrder),
    groupKey: null,
    id,
    name: mob.FSLName,
    status: "ACTIVE",
    variant: null,
  } satisfies FellowshipUnitCatalogEntry;

  const override: UnitCatalogOverride | undefined = UNIT_CATALOG_OVERRIDES[id];

  if (override === undefined) {
    return defaultEntry;
  }

  return {
    ...defaultEntry,
    ...override,
  };
}

function createUnitCatalog(
  externalMobData: ExternalMobData,
): FellowshipUnitCatalog {
  const catalog = Object.entries(externalMobData).map(([id, mob]) => {
    return createUnitCatalogEntry({
      id,
      mob,
    });
  });

  return A.sort(catalog, UnitCatalogEntryOrder);
}

export const generateFellowshipUnitCatalog = E.fn(
  "generate-fellowship-unit-catalog",
)(function* (inputFilePath: string) {
  const fileSystem = yield* FileSystem.FileSystem;

  const contents = yield* fileSystem.readFileString(inputFilePath);

  const json = yield* parseJson({
    contents,
    onError: (cause) => {
      return new FellowshipUnitCatalogJsonParseError({
        cause,
        filePath: inputFilePath,
      });
    },
  });

  const externalMobData = yield* Schema.decodeUnknownEffect(
    ExternalMobDataSchema,
  )(json);

  const catalog = createUnitCatalog(externalMobData);

  const validatedCatalog = yield* Schema.decodeEffect(
    FellowshipUnitCatalogSchema,
  )(catalog);

  // Pretty-printing is intentional for this generated human-readable artifact.
  // @effect-diagnostics-next-line preferSchemaOverJson:off
  const outputContents = `${JSON.stringify(validatedCatalog, null, 2)}\n`;

  yield* fileSystem.writeFileString(OUTPUT_FILE_PATH, outputContents);
  yield* fixWithBiome([OUTPUT_FILE_PATH]);

  yield* E.logInfo("Generated Fellowship unit catalog.", {
    inputFilePath,
    outputFilePath: OUTPUT_FILE_PATH,
    unitCount: validatedCatalog.length,
  });
});
