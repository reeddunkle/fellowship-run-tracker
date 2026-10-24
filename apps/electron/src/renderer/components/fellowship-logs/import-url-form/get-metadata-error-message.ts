import { getErrorTag } from "@frt/shared/util/get-error-tag.ts";

import { getRateLimitExceededMessage } from "@/renderer/api/fellowship-logs/fellowship-logs-point-messages.ts";

const METADATA_ERROR_MESSAGE_BY_TAG: Partial<Record<string, string>> = {
  FellowshipLogsApiDungeonLevelNotFoundError:
    "This run doesn't have a dungeon level in Fellowship Logs, so it can't be imported.",
  FellowshipLogsApiReportAccessDeniedError:
    "This connection doesn't have permission to view that report. Use a connection with access, or choose a public report.",
  FellowshipLogsApiRunNotFinishedError:
    "This run hasn't finished yet. Try again once it's complete in Fellowship Logs.",
  FellowshipLogsApiRunNotFoundError:
    "We couldn't find that report and fight. Double-check the URL.",
};

export function getMetadataErrorMessage(
  error: unknown,
  nowMilliseconds: number,
): string {
  const rateLimitExceededMessage = getRateLimitExceededMessage(
    error,
    nowMilliseconds,
  );

  if (rateLimitExceededMessage !== undefined) {
    return rateLimitExceededMessage;
  }

  const tag = getErrorTag(error);

  return (
    (tag === undefined ? undefined : METADATA_ERROR_MESSAGE_BY_TAG[tag]) ??
    "Something went wrong contacting Fellowship Logs."
  );
}
