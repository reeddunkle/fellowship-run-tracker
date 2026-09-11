import * as Cause from "effect/Cause";
import * as Match from "effect/Match";
import * as Option from "effect/Option";

import { getErrorTag } from "@/util/get-error-tag.ts";

import { type FellowshipTrackerFailure } from "./fellowship-tracker-service-types.ts";

const classifyError = (error: unknown): FellowshipTrackerFailure => {
  const errorTag = getErrorTag(error);

  if (errorTag === "PlatformError") {
    return {
      _tag: "FileSystem",
    };
  }

  return Match.value(errorTag).pipe(
    Match.when("DuplicateMilestoneRequirementsError", () => {
      return {
        _tag: "Configuration",
      } satisfies FellowshipTrackerFailure;
    }),
    Match.orElse(() => {
      return {
        _tag: "Unexpected",
      } satisfies FellowshipTrackerFailure;
    }),
  );
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
