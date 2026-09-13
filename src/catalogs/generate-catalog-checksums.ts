import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import * as NodeFileSystem from "@effect/platform-node/NodeFileSystem";
import * as A from "effect/Array";
import * as Crypto from "effect/Crypto";
import * as E from "effect/Effect";
import * as Encoding from "effect/Encoding";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as ManagedRuntime from "effect/ManagedRuntime";
import * as Order from "effect/Order";
import * as Schema from "effect/Schema";

import { FELLOWSHIP_ABILITY } from "@/catalogs/ability/fellowship-ability-catalog.ts";
import { FELLOWSHIP_DUNGEON } from "@/catalogs/dungeon/fellowship-dungeon-catalog.ts";
import { FELLOWSHIP_ENCOUNTER } from "@/catalogs/encounter/fellowship-encounter-catalog.ts";
import { loadFellowshipUnitCatalog } from "@/catalogs/unit/load-fellowship-unit-catalog.ts";
import { UnknownFromJsonStringSchema } from "@/validation/common-schemas.ts";

const OUTPUT_FILE_PATH = "./src/catalogs/generated/catalog-checksums.ts";

const stringOrder = Order.String;

const encodeJson = Schema.encodeSync(UnknownFromJsonStringSchema);

const sortByJson = <Value>(values: Iterable<Value>): ReadonlyArray<Value> => {
  return pipe(
    A.fromIterable(values),
    A.sort(
      Order.mapInput(stringOrder, (value: Value) => {
        return encodeJson(value);
      }),
    ),
  );
};

const hashCatalog = E.fn("hash-catalog")(function* (
  catalog: ReadonlyArray<unknown>,
) {
  const crypto = yield* Crypto.Crypto;

  const contents = encodeJson(catalog);
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
    ability: yield* hashCatalog(sortByJson(Object.values(FELLOWSHIP_ABILITY))),
    dungeon: yield* hashCatalog(sortByJson(Object.values(FELLOWSHIP_DUNGEON))),
    encounter: yield* hashCatalog(
      sortByJson(Object.values(FELLOWSHIP_ENCOUNTER)),
    ),
    unit: yield* hashCatalog(sortByJson(unitCatalog)),
  } as const;

  const contents = `// This file is generated. Do not edit manually.

export const CATALOG_CHECKSUMS = ${encodeJson(checksums)} as const;
`;

  yield* fileSystem.makeDirectory("./src/catalogs/generated", {
    recursive: true,
  });

  yield* fileSystem.writeFileString(OUTPUT_FILE_PATH, contents);
});

const RuntimeLive = Layer.mergeAll(NodeCrypto.layer, NodeFileSystem.layer);

const runtime = ManagedRuntime.make(RuntimeLive);

await runtime.runPromise(generateCatalogChecksums);
await runtime.dispose();
