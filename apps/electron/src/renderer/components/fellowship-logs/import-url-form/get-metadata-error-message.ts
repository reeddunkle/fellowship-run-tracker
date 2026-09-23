import { getErrorTag } from "@frt/shared/util/get-error-tag.ts";

import {
  getRateLimitExceededMessage,
  getRateLimitExceededResetsAt,
} from "@/renderer/api/fellowship-logs/fellowship-logs-rate-limit-messages.ts";

const METADATA_ERROR_MESSAGE_BY_TAG: Partial<Record<string, string>> = {
  FellowshipLogsApiDungeonLevelNotFoundError:
    "This run doesn't have a dungeon level in Fellowship Logs, so it can't be imported.",
  FellowshipLogsApiRunNotFinishedError:
    "This run hasn't finished yet. Try again once it's complete in Fellowship Logs.",
  FellowshipLogsApiRunNotFoundError:
    "We couldn't find that report and fight. Double-check the URL.",
};

export function getMetadataErrorMessage(
  error: unknown,
  nowMilliseconds: number,
): string {
  const resetsAtMilliseconds = getRateLimitExceededResetsAt(error);

  if (resetsAtMilliseconds !== undefined) {
    return getRateLimitExceededMessage(resetsAtMilliseconds, nowMilliseconds);
  }

  const tag = getErrorTag(error);

  return (
    (tag === undefined ? undefined : METADATA_ERROR_MESSAGE_BY_TAG[tag]) ??
    "Something went wrong contacting Fellowship Logs."
  );
}
