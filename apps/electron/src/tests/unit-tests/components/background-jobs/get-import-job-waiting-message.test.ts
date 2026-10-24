import { describe, expect, test } from "vitest";

import { getImportJobWaitingMessage } from "@/renderer/components/background-jobs/get-import-job-waiting-message.ts";
import { formatLocalTimeFromMilliseconds } from "@/util/format-date-time.ts";

const NOW = 1_000_000;

const RESUMES_AT = NOW + 37 * 60 * 1_000;

describe("getImportJobWaitingMessage", () => {
  test.each([
    ["USER_QUOTA_RESET", "Out of your account points."],
    ["APPLICATION_QUOTA_RESET", "Out of API client points."],
    [
      "SHARED_APPLICATION_CAPACITY_UNAVAILABLE",
      "Fellowship Logs is temporarily limiting this connection.",
    ],
  ] as const)("says when a %s wait resumes", (reason, summary) => {
    expect(getImportJobWaitingMessage(reason, RESUMES_AT, NOW)).toBe(
      `${summary} Resumes in 37 minutes, at ${formatLocalTimeFromMilliseconds(RESUMES_AT)}.`,
    );
  });

  test("says a quota wait is resuming once its time has passed", () => {
    expect(getImportJobWaitingMessage("USER_QUOTA_RESET", NOW - 1, NOW)).toBe(
      "Out of your account points. Resuming shortly.",
    );
  });

  test("treats a job without a reason as an application quota wait", () => {
    expect(getImportJobWaitingMessage(null, null, NOW)).toBe(
      "Out of API client points. Resuming shortly.",
    );
  });

  test.each([
    [
      "CONNECTION_REQUIRED",
      "Paused until you connect to Fellowship Logs above.",
    ],
    [
      "REAUTHORIZATION_REQUIRED",
      "Paused until you sign in to Fellowship Logs again above.",
    ],
    [
      "LOCAL_PROTECTION_ACKNOWLEDGEMENT_REQUIRED",
      "Paused until you sign in again above and allow local encryption.",
    ],
    [
      "POINT_SYSTEM_OPT_IN_REQUIRED",
      "Paused until you opt into the Fellowship Logs point system above.",
    ],
    [
      "PROFILE_CHANGE_CONFIRMATION_REQUIRED",
      "Queued under a different Fellowship Logs connection. Continue it with the current connection or cancel it.",
    ],
  ] as const)("names the action a %s wait needs", (reason, message) => {
    expect(getImportJobWaitingMessage(reason, null, NOW)).toBe(message);
  });
});
