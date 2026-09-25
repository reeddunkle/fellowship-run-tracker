import path from "node:path";

import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeServices from "@effect/platform-node/NodeServices";
import * as A from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as E from "effect/Effect";
import * as Encoding from "effect/Encoding";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as Order from "effect/Order";

import { FELLOWSHIP_ABILITY } from "@frt/db/catalogs/ability/fellowship-ability-catalog.ts";
import { CATALOG_CHECKSUMS_FILE_PATH } from "@frt/db/catalogs/catalog-paths.ts";
import { FELLOWSHIP_DUNGEON } from "@frt/db/catalogs/dungeon/fellowship-dungeon-catalog.ts";
import { FELLOWSHIP_ENCOUNTER } from "@frt/db/catalogs/encounter/fellowship-encounter-catalog.ts";
import { loadFellowshipUnitCatalog } from "@frt/db/catalogs/unit/load-fellowship-unit-catalog.ts";
import { encodeJson } from "@frt/shared/util/common-schemas.ts";

const OUTPUT_FILE_PATH = CATALOG_CHECKSUMS_FILE_PATH;

const GENERATED_DIRECTORY_PATH = path.dirname(OUTPUT_FILE_PATH);

const stringOrder = Order.String;

type JsonSortEntry<Value> = {
  readonly encodedValue: string;
  readonly value: Value;
};

const sortByJson = E.fn("sort-by-json")(function* <Value>(
  values: Iterable<Value>,
) {
  const encodedValues = yield* E.forEach(values, (value) => {
    return encodeJson(value).pipe(
      E.map((encodedValue): JsonSortEntry<Value> => {
        return {
          encodedValue,
          value,
        };
      }),
    );
  });

  return pipe(
    encodedValues,
    A.sort(
      Order.mapInput(stringOrder, (entry: JsonSortEntry<Value>) => {
        return entry.encodedValue;
      }),
    ),
    A.map((entry) => {
      return entry.value;
    }),
  );
});

const hashCatalog = E.fn("hash-catalog")(function* (
  catalog: ReadonlyArray<unknown>,
) {
  const crypto = yield* Crypto.Crypto;

  const contents = yield* encodeJson(catalog);
  const digest = yield* crypto.digest(
    "SHA-256",
    new TextEncoder().encode(contents),
  );

  return Encoding.encodeHex(digest);
});

const generateCatalogChecksums = E.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;

  const unitCatalog = yield* loadFellowshipUnitCatalog();

  const checksums = {
    ability: yield* hashCatalog(
      yield* sortByJson(Object.values(FELLOWSHIP_ABILITY)),
    ),
    dungeon: yield* hashCatalog(
      yield* sortByJson(Object.values(FELLOWSHIP_DUNGEON)),
    ),
    encounter: yield* hashCatalog(
      yield* sortByJson(Object.values(FELLOWSHIP_ENCOUNTER)),
    ),
    unit: yield* hashCatalog(yield* sortByJson(unitCatalog)),
  } as const;

  const encodedChecksums = yield* encodeJson(checksums);

  const contents = `// This file is generated. Do not edit manually.

export const CATALOG_CHECKSUMS = ${encodedChecksums} as const;
`;

  yield* fileSystem.makeDirectory(GENERATED_DIRECTORY_PATH, {
    recursive: true,
  });

  yield* fileSystem.writeFileString(OUTPUT_FILE_PATH, contents);
});

const RuntimeLayer = Layer.mergeAll(NodeCrypto.layer, NodeServices.layer);

const runtime = ManagedRuntime.make(RuntimeLayer);

try {
  await runtime.runPromise(generateCatalogChecksums);
} finally {
  await runtime.dispose();
}
