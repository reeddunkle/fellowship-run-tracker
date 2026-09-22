import * as Schema from "effect/Schema";

import { NonEmptyStringSchema } from "@frt/shared/validation/common-schemas.ts";

export const FellowshipLogsReportCodeSchema = NonEmptyStringSchema.pipe(
  Schema.brand("FellowshipLogsReportCode"),
);

export type FellowshipLogsReportCode =
  typeof FellowshipLogsReportCodeSchema.Type;
