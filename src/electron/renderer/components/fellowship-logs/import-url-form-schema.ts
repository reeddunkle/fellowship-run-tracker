import * as Schema from "effect/Schema";

import { FellowshipLogsReportUrlSchema } from "@/validation/fellowship-logs/fellowship-logs-report-url-schema.ts";

export const ImportDungeonRunUrlFormSchema = Schema.Struct({
  reportUrl: FellowshipLogsReportUrlSchema,
});

export type ImportDungeonRunUrlFormValue =
  typeof ImportDungeonRunUrlFormSchema.Encoded;

export type DecodedImportDungeonRunUrlFormValue =
  typeof ImportDungeonRunUrlFormSchema.Type;

export const ImportDungeonRunUrlFormStandardSchema = Schema.toStandardSchemaV1(
  ImportDungeonRunUrlFormSchema,
);
