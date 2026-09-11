import * as Data from "effect/Data";

import { type CompiledRequirement } from "@/services/fellowship/configurations/configuration-types.ts";

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
}> {}
