import * as Schema from "effect/Schema";

export const BACKGROUND_JOB_RESET_WAITING_REASONS = [
  "APPLICATION_QUOTA_RESET",
  "SHARED_APPLICATION_CAPACITY_UNAVAILABLE",
  "USER_QUOTA_RESET",
] as const;

export const BACKGROUND_JOB_CONDITION_WAITING_REASONS = [
  "CONNECTION_REQUIRED",
  "LOCAL_PROTECTION_ACKNOWLEDGEMENT_REQUIRED",
  "POINT_SYSTEM_OPT_IN_REQUIRED",
  "REAUTHORIZATION_REQUIRED",
] as const;

export const BackgroundJobWaitingReasonSchema = Schema.Literals([
  ...BACKGROUND_JOB_CONDITION_WAITING_REASONS,
  ...BACKGROUND_JOB_RESET_WAITING_REASONS,
  "PROFILE_CHANGE_CONFIRMATION_REQUIRED",
]);

export type BackgroundJobWaitingReason =
  typeof BackgroundJobWaitingReasonSchema.Type;

export type BackgroundJobConditionWaitingReason =
  (typeof BACKGROUND_JOB_CONDITION_WAITING_REASONS)[number];

export const BackgroundJobWaitingKindSchema = Schema.Literals([
  "CONDITION",
  "HOLD",
  "RESET",
]);

export type BackgroundJobWaitingKind =
  typeof BackgroundJobWaitingKindSchema.Type;

const RESET_WAITING_REASONS: ReadonlySet<BackgroundJobWaitingReason> = new Set(
  BACKGROUND_JOB_RESET_WAITING_REASONS,
);

export function getBackgroundJobWaitingKind(
  waitingReason: BackgroundJobWaitingReason,
): BackgroundJobWaitingKind {
  if (RESET_WAITING_REASONS.has(waitingReason)) {
    return "RESET";
  }

  return waitingReason === "PROFILE_CHANGE_CONFIRMATION_REQUIRED"
    ? "HOLD"
    : "CONDITION";
}
