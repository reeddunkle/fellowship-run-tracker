import * as Data from "effect/Data";

import { type ConfigurationDefinitionId } from "@/validation/configuration/configuration-definition-id-schema.ts";
import { type ConfigurationId } from "@/validation/configuration/configuration-id-schema.ts";
import { type MilestoneId } from "@/validation/milestone/milestone-id-schema.ts";
import { type RequirementId } from "@/validation/requirement/requirement-id-schema.ts";

export type ConfigurationDAOErrorDetails =
  | {
      readonly _tag: "ConfigurationDefinitionNotFound";
      readonly configurationDefinitionId: ConfigurationDefinitionId;
    }
  | {
      readonly _tag: "ConfigurationNotFoundAfterPersist";
      readonly configurationId: ConfigurationId;
    }
  | {
      readonly _tag: "ConfigurationToReplaceNotFound";
      readonly configurationId: ConfigurationId;
    }
  | {
      readonly _tag: "DuplicateConfiguration";
      readonly configurationId: ConfigurationId;
    }
  | {
      readonly _tag: "PersistedMilestoneNotFound";
      readonly configurationId: ConfigurationId;
    }
  | {
      readonly _tag: "SubmittedRequirementNotFound";
      readonly requirementId: RequirementId;
    }
  | {
      readonly _tag: "PersistedRequirementNotFound";
      readonly milestoneId: MilestoneId;
    }
  | {
      readonly _tag: "Unexpected";
      readonly cause: unknown;
    };

export class ConfigurationDAOError extends Data.TaggedError(
  "ConfigurationDAOError",
)<{
  readonly details: ConfigurationDAOErrorDetails;
}> {}
