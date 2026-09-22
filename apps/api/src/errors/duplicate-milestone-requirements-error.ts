import * as Data from "effect/Data";

import { type CompiledRequirement } from "@frt/shared/fellowship/configurations/configuration-types.ts";

export type DuplicateMilestoneDetails = {
  readonly index: number;
  readonly label: string;
  readonly requirements: ReadonlyArray<CompiledRequirement>;
};

export class DuplicateMilestoneRequirementsError extends Data.TaggedError(
  "DuplicateMilestoneRequirementsError",
)<{
  readonly duplicate: DuplicateMilestoneDetails;
  readonly milestoneId: string;
  readonly original: DuplicateMilestoneDetails;
}> {
  override get message() {
    return `Milestone "${this.duplicate.label}" (#${this.duplicate.index + 1}) has the same requirements as milestone "${this.original.label}" (#${this.original.index + 1}).`;
  }
}
