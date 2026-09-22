import * as Schema from "effect/Schema";

import { FellowshipLogsReportUrlSchema } from "@frt/api/validation/fellowship-logs/fellowship-logs-report-url-schema.ts";

export const ImportDungeonRunUrlFormSchema = Schema.Struct({
  reportUrl: FellowshipLogsReportUrlSchema,
});

export const ImportDungeonRunUrlFormStandardSchema = Schema.toStandardSchemaV1(
  ImportDungeonRunUrlFormSchema,
);
