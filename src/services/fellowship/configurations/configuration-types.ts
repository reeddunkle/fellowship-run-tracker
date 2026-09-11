import type * as HashMap from "effect/HashMap";

import { type RequirementTargetId } from "@/services/fellowship/requirements/requirement-lookup.ts";
import { type DungeonId } from "@/services/fellowship/validation/fellowship-common.ts";
import { type FellowshipMilestoneDefinition } from "@/services/fellowship/validation/fellowship-configuration-file-schema.ts";
import { type RequirementEventType } from "@/services/fellowship/validation/requirement-event-type-schema.ts";

export type FellowshipMilestoneConfiguration = {
  readonly dungeonId: DungeonId;
  readonly dungeonLevel: number;
  readonly milestones: ReadonlyArray<FellowshipMilestoneDefinition>;
};

export type ConfigurationDefinitionRequirement = {
  readonly requiredCount: number;
  readonly startOccurrence: number;
  readonly targetId: RequirementTargetId;
  readonly type: RequirementEventType;
};

export type FellowshipConfigurationDefinition = {
  readonly dungeonId: DungeonId;
  readonly dungeonLevel: number;
  readonly requirements: ReadonlyArray<ConfigurationDefinitionRequirement>;
};

export type CompiledRequirement = ConfigurationDefinitionRequirement;

export type CompiledMilestoneDefinition = Omit<
  FellowshipMilestoneDefinition,
  "requirements"
> & {
  readonly milestoneId: string;
  readonly requirements: ReadonlyArray<CompiledRequirement>;
};

export type RequirementReference = {
  readonly milestoneId: string;
  readonly requiredCount: number;
  readonly startOccurrence: number;
};

export type RequirementReferencesByTargetId = HashMap.HashMap<
  RequirementTargetId,
  ReadonlyArray<RequirementReference>
>;

export type RequirementsByEvent = HashMap.HashMap<
  RequirementEventType,
  RequirementReferencesByTargetId
>;

export type CompiledConfiguration = Omit<
  FellowshipMilestoneConfiguration,
  "milestones"
> & {
  readonly milestones: ReadonlyArray<CompiledMilestoneDefinition>;
  readonly milestonesById: HashMap.HashMap<string, CompiledMilestoneDefinition>;
  readonly requirementsByEvent: RequirementsByEvent;
};
