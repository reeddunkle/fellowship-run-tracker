import * as Data from "effect/Data";

import { type MilestoneId } from "@/validation/milestone/milestone-id-schema.ts";

export type ConfigurationPersistenceErrorDetails =
  | {
      readonly _tag: "RequirementNotResolved";
      readonly milestoneLabel: string;
      readonly requirementIdentityKey: string;
    }
  | {
      readonly _tag: "PersistedMilestoneHasNoRequirements";
      readonly milestoneId: MilestoneId;
    }
  | {
      readonly _tag: "Unexpected";
      readonly cause: unknown;
    };

export class ConfigurationPersistenceError extends Data.TaggedError(
  "ConfigurationPersistenceError",
)<{
  readonly details: ConfigurationPersistenceErrorDetails;
}> {}
