import * as Cause from "effect/Cause";
import * as Option from "effect/Option";

import { getErrorTag } from "@frt/shared/util/get-error-tag.ts";

import { type FellowshipTrackerFailure } from "./fellowship-tracker-service.ts";

const classifyError = (error: unknown): FellowshipTrackerFailure => {
  const errorTag = getErrorTag(error);

  if (errorTag === "PlatformError") {
    return {
      _tag: "FileSystem",
    };
  }

  if (errorTag === "DuplicateMilestoneRequirementsError") {
    return {
      _tag: "Configuration",
    };
  }

  return {
    _tag: "Unexpected",
  };
};

export const classifyTrackingFailure = (
  cause: Cause.Cause<unknown>,
): FellowshipTrackerFailure => {
  const error = Cause.findErrorOption(cause);

  if (Option.isSome(error)) {
    return classifyError(error.value);
  }

  return {
    _tag: "Unexpected",
  };
};
