// @effect-diagnostics-next-line nodeBuiltinImport:off
import path from "node:path";

/*
 * Source file locations for the catalog generators (dev tooling in
 * `tools/dev-scripts` and `apps/cli`). Only meaningful when running from the
 * workspace, so runtime code shouldn't import this module.
 */

export const CATALOG_CHECKSUMS_FILE_PATH = path.join(
  import.meta.dirname,
  "generated",
  "catalog-checksums.ts",
);

export const FELLOWSHIP_UNIT_CATALOG_FILE_PATH = path.join(
  import.meta.dirname,
  "unit",
  "fellowship-unit-catalog.json",
);
