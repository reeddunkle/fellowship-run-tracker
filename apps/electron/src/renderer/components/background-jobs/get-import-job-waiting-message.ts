import { type BackgroundJobWaitingReason } from "@frt/shared/background-job/background-job-waiting-reason-schema.ts";

import { formatResetTime } from "@/renderer/api/fellowship-logs/fellowship-logs-point-messages.ts";

const CONDITION_MESSAGES = {
  CONNECTION_REQUIRED: "Paused until you connect to Fellowship Logs above.",
  LOCAL_PROTECTION_ACKNOWLEDGEMENT_REQUIRED:
    "Paused until you sign in again above and allow local encryption.",
  POINT_SYSTEM_OPT_IN_REQUIRED:
    "Paused until you opt into the Fellowship Logs point system above.",
  PROFILE_CHANGE_CONFIRMATION_REQUIRED:
    "Queued under a different Fellowship Logs connection. Continue it with the current connection or cancel it.",
  REAUTHORIZATION_REQUIRED:
    "Paused until you sign in to Fellowship Logs again above.",
} as const satisfies Partial<Record<BackgroundJobWaitingReason, string>>;

const RESET_SUMMARIES = {
  APPLICATION_QUOTA_RESET: "Out of API client points.",
  SHARED_APPLICATION_CAPACITY_UNAVAILABLE:
    "Fellowship Logs is temporarily limiting this connection.",
  USER_QUOTA_RESET: "Out of your account points.",
} as const satisfies Partial<Record<BackgroundJobWaitingReason, string>>;

function isConditionReason(
  reason: BackgroundJobWaitingReason,
): reason is keyof typeof CONDITION_MESSAGES {
  return Object.hasOwn(CONDITION_MESSAGES, reason);
}

export function getImportJobWaitingMessage(
  waitingReason: BackgroundJobWaitingReason | null,
  availableAtMilliseconds: number | null,
  nowMilliseconds: number,
): string {
  const reason = waitingReason ?? "APPLICATION_QUOTA_RESET";

  if (isConditionReason(reason)) {
    return CONDITION_MESSAGES[reason];
  }

  const summary = RESET_SUMMARIES[reason];

  return availableAtMilliseconds === null ||
    availableAtMilliseconds <= nowMilliseconds
    ? `${summary} Resuming shortly.`
    : `${summary} Resumes in ${formatResetTime(availableAtMilliseconds, nowMilliseconds)}.`;
}

export const WAITING_BEHIND_PAUSED_IMPORT_MESSAGE =
  "Waiting for the paused import ahead of it.";
