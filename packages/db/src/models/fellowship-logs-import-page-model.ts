import * as Schema from "effect/Schema";
import * as Model from "effect/unstable/schema/Model";

import { BackgroundJobIdSchema } from "@frt/shared/validation/background-job/background-job-id-schema.ts";
import { NonNegativeIntegerSchema } from "@frt/shared/validation/common-schemas.ts";

const ProgressSchema = Schema.Finite.check(
  Schema.isBetween({ maximum: 1, minimum: 0 }),
);

/**
 * A report page an import job has fetched. The API encodes and decodes `page`;
 * the database only checks it's valid JSON.
 */
export class FellowshipLogsImportPageModel extends Model.Class<FellowshipLogsImportPageModel>(
  "FellowshipLogsImportPageModel",
)({
  backgroundJobId: BackgroundJobIdSchema,
  createdAt: Model.DateTimeInsertFromNumber,
  /** `null` when this was the fight's last page. */
  nextPageTimestamp: Schema.NullOr(Schema.Finite),
  /** The page as JSON text. */
  page: Schema.String,
  pageIndex: NonNegativeIntegerSchema,
  /** How much of the fight had been fetched after this page, from 0 to 1. */
  progress: ProgressSchema,
  reportRevision: NonNegativeIntegerSchema,
}) {}
