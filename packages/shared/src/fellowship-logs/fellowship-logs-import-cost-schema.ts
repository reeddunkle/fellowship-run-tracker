import * as Schema from "effect/Schema";

import { type FellowshipLogsConnectionProfile } from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";

export const FellowshipLogsImportOutcomeSchema = Schema.Literals([
  "SUCCEEDED",
  "FAILED",
  "DEFERRED",
  "CANCELLED",
]);

export type FellowshipLogsImportOutcome =
  typeof FellowshipLogsImportOutcomeSchema.Type;

export type FellowshipLogsImportCostObservation = {
  readonly apiRequestCount: number;
  readonly applicationPoints: number;
  readonly cacheHitCount: number;
  readonly completedAtMilliseconds: number;
  readonly followsProfileChange: boolean;
  readonly includesLookup: boolean;
  readonly isResumed: boolean;
  readonly outcome: FellowshipLogsImportOutcome;
  readonly pointPolicyVersion: string;
  readonly profile: FellowshipLogsConnectionProfile | null;
  readonly totalPoints: number;
  readonly unmeasuredRequestCount: number;
  readonly userPoints: number;
};
