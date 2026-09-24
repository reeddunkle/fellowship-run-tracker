import { type BackgroundJobFailure } from "@frt/shared/background-job/background-job-failure-schema.ts";

const FAILURE_MESSAGE_BY_TAG: Partial<Record<string, string>> = {
  BackgroundJobAttemptsExhaustedError:
    "The import was interrupted too many times.",
  FellowshipLogsDungeonRunImportAlreadyImportedError:
    "This run has already been imported.",
  FellowshipLogsDungeonRunImportDungeonLevelNotFoundError:
    "This run doesn't have a dungeon level, so it can't be imported.",
  FellowshipLogsDungeonRunImportRunNotFinishedError:
    "This run hadn't finished in Fellowship Logs.",
  FellowshipLogsDungeonRunImportRunNotFoundError:
    "We couldn't find a dungeon run in that report and fight.",
  FellowshipLogsRateLimitExceededError:
    "Ran out of Fellowship Logs points before the import finished.",
  FellowshipLogsRequestError:
    "Something went wrong contacting Fellowship Logs.",
};

export function getImportJobFailureMessage(
  error: BackgroundJobFailure | null,
): string {
  return (
    (error === null ? undefined : FAILURE_MESSAGE_BY_TAG[error.tag]) ??
    "Something went wrong importing this run."
  );
}
