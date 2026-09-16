import * as Data from "effect/Data";
import * as Schema from "effect/Schema";

import { type FellowshipLogsFightId } from "@/validation/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { type FellowshipLogsReportCode } from "@/validation/fellowship-logs/fellowship-logs-report-code-schema.ts";

export class FellowshipLogsDungeonRunImportRunNotFoundError extends Data.TaggedError(
  "FellowshipLogsDungeonRunImportRunNotFoundError",
)<{
  readonly fightId: number;
  readonly reportCode: string;
}> {}

export class FellowshipLogsDungeonRunImportRunNotFinishedError extends Data.TaggedError(
  "FellowshipLogsDungeonRunImportRunNotFinishedError",
)<{
  readonly fightId: number;
  readonly reportCode: string;
}> {}

export class FellowshipLogsDungeonRunImportDungeonLevelNotFoundError extends Data.TaggedError(
  "FellowshipLogsDungeonRunImportDungeonLevelNotFoundError",
)<{
  readonly fightId: FellowshipLogsFightId;
  readonly reportCode: FellowshipLogsReportCode;
}> {}

const FELLOWSHIP_LOGS_API_RUN_NOT_FOUND_ERROR =
  "FellowshipLogsApiRunNotFoundError" as const;

export class FellowshipLogsApiRunNotFoundError extends Data.TaggedError(
  FELLOWSHIP_LOGS_API_RUN_NOT_FOUND_ERROR,
)<{
  readonly fightId: number;
  readonly message: string;
  readonly reportCode: string;
}> {}

export const FellowshipLogsApiRunNotFoundErrorSchema = Schema.Struct({
  _tag: Schema.Literal(FELLOWSHIP_LOGS_API_RUN_NOT_FOUND_ERROR),
  fightId: Schema.Finite,
  message: Schema.String,
  reportCode: Schema.String,
});

const FELLOWSHIP_LOGS_API_RUN_NOT_FINISHED_ERROR =
  "FellowshipLogsApiRunNotFinishedError" as const;

export class FellowshipLogsApiRunNotFinishedError extends Data.TaggedError(
  FELLOWSHIP_LOGS_API_RUN_NOT_FINISHED_ERROR,
)<{
  readonly fightId: number;
  readonly message: string;
  readonly reportCode: string;
}> {}

export const FellowshipLogsApiRunNotFinishedErrorSchema = Schema.Struct({
  _tag: Schema.Literal(FELLOWSHIP_LOGS_API_RUN_NOT_FINISHED_ERROR),
  fightId: Schema.Finite,
  message: Schema.String,
  reportCode: Schema.String,
});
