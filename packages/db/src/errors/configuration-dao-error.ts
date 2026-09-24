import * as Data from "effect/Data";

import { type UnexpectedDatabaseError } from "@frt/db/errors/unexpected-database-error.ts";
import { type ConfigurationDefinitionId } from "@frt/db/validation/configuration/configuration-definition-id-schema.ts";
import { type MilestoneId } from "@frt/db/validation/milestone/milestone-id-schema.ts";
import { type RequirementId } from "@frt/db/validation/requirement/requirement-id-schema.ts";
import { type ConfigurationId } from "@frt/shared/configuration/configuration-id-schema.ts";

export class ConfigurationDefinitionNotFoundError extends Data.TaggedError(
  "ConfigurationDefinitionNotFoundError",
)<{
  readonly configurationDefinitionId: ConfigurationDefinitionId;
}> {
  override get message() {
    return `Configuration definition not found: ${this.configurationDefinitionId}.`;
  }
}

export class ConfigurationNotFoundAfterPersistError extends Data.TaggedError(
  "ConfigurationNotFoundAfterPersistError",
)<{
  readonly configurationId: ConfigurationId;
}> {
  override get message() {
    return `Configuration not found after persisting it: ${this.configurationId}.`;
  }
}

export class ConfigurationToReplaceNotFoundError extends Data.TaggedError(
  "ConfigurationToReplaceNotFoundError",
)<{
  readonly configurationId: ConfigurationId;
}> {
  override get message() {
    return `Configuration to replace not found: ${this.configurationId}.`;
  }
}

export class ConfigurationDuplicateError extends Data.TaggedError(
  "ConfigurationDuplicateError",
)<{
  readonly configurationId: ConfigurationId;
}> {
  override get message() {
    return `An identical configuration already exists: ${this.configurationId}.`;
  }
}

export class ConfigurationPersistedMilestoneNotFoundError extends Data.TaggedError(
  "ConfigurationPersistedMilestoneNotFoundError",
)<{
  readonly configurationId: ConfigurationId;
}> {
  override get message() {
    return `Persisted milestone not found for configuration: ${this.configurationId}.`;
  }
}

export class ConfigurationSubmittedRequirementNotFoundError extends Data.TaggedError(
  "ConfigurationSubmittedRequirementNotFoundError",
)<{
  readonly requirementId: RequirementId;
}> {
  override get message() {
    return `Submitted requirement not found: ${this.requirementId}.`;
  }
}

export class ConfigurationPersistedRequirementNotFoundError extends Data.TaggedError(
  "ConfigurationPersistedRequirementNotFoundError",
)<{
  readonly milestoneId: MilestoneId;
}> {
  override get message() {
    return `Persisted requirement not found for milestone: ${this.milestoneId}.`;
  }
}

export class ConfigurationRequirementNotResolvedError extends Data.TaggedError(
  "ConfigurationRequirementNotResolvedError",
)<{
  readonly milestoneLabel: string;
  readonly requirementIdentityKey: string;
}> {
  override get message() {
    return `Requirement "${this.requirementIdentityKey}" in milestone "${this.milestoneLabel}" could not be resolved.`;
  }
}

export class ConfigurationPersistedMilestoneHasNoRequirementsError extends Data.TaggedError(
  "ConfigurationPersistedMilestoneHasNoRequirementsError",
)<{
  readonly milestoneId: MilestoneId;
}> {
  override get message() {
    return `Persisted milestone has no requirements: ${this.milestoneId}.`;
  }
}

export type ConfigurationDAOErrorReason =
  | ConfigurationDefinitionNotFoundError
  | ConfigurationDuplicateError
  | ConfigurationNotFoundAfterPersistError
  | ConfigurationPersistedMilestoneHasNoRequirementsError
  | ConfigurationPersistedMilestoneNotFoundError
  | ConfigurationPersistedRequirementNotFoundError
  | ConfigurationRequirementNotResolvedError
  | ConfigurationSubmittedRequirementNotFoundError
  | ConfigurationToReplaceNotFoundError
  | UnexpectedDatabaseError;

export class ConfigurationDAOError extends Data.TaggedError(
  "ConfigurationDAOError",
)<{
  readonly reason: ConfigurationDAOErrorReason;
}> {
  override readonly cause = this.reason;

  override get message() {
    return this.reason.message;
  }
}
