import * as Context from "effect/Context";
import type * as E from "effect/Effect";
import type * as Option from "effect/Option";

import { type DungeonRunModel } from "@/db/models/dungeon-run-model.ts";
import { type DungeonRunDAOError } from "@/errors/dungeon-run-dao-error.ts";
import { type ConfigurationDefinitionId } from "@/validation/configuration/configuration-definition-id-schema.ts";
import { type DungeonRunId } from "@/validation/dungeon-run/dungeon-run-id-schema.ts";

type GetDungeonRunByIdOptions = {
  readonly id: DungeonRunId;
};

type CreateDungeonRunOptions = {
  readonly configurationDefinitionId: ConfigurationDefinitionId;
  readonly dungeonId: DungeonRunModel["dungeonId"];
  readonly dungeonLevel: DungeonRunModel["dungeonLevel"];
};

type StartDungeonRunOptions = {
  readonly dungeonRunId: DungeonRunId;
  readonly startedAt: NonNullable<DungeonRunModel["startedAt"]>;
};

type CompleteDungeonRunOptions = {
  readonly dungeonRunId: DungeonRunId;
  readonly endedAt: NonNullable<DungeonRunModel["endedAt"]>;
};

type ExitDungeonRunOptions = {
  readonly dungeonRunId: DungeonRunId;
  readonly endedAt: NonNullable<DungeonRunModel["endedAt"]>;
};

type InterruptDungeonRunOptions = {
  readonly dungeonRunId: DungeonRunId;
  readonly endedAt: NonNullable<DungeonRunModel["endedAt"]>;
};

type DeleteHistoryByConfigurationDefinitionIdOptions = {
  readonly configurationDefinitionId: ConfigurationDefinitionId;
};

export type DungeonRunDAOShape = {
  readonly complete: (
    options: CompleteDungeonRunOptions,
  ) => E.Effect<void, DungeonRunDAOError>;

  readonly create: (
    options: CreateDungeonRunOptions,
  ) => E.Effect<DungeonRunModel, DungeonRunDAOError>;

  readonly exit: (
    options: ExitDungeonRunOptions,
  ) => E.Effect<void, DungeonRunDAOError>;

  readonly getById: (
    options: GetDungeonRunByIdOptions,
  ) => E.Effect<Option.Option<DungeonRunModel>, DungeonRunDAOError>;

  readonly interrupt: (
    options: InterruptDungeonRunOptions,
  ) => E.Effect<void, DungeonRunDAOError>;

  readonly start: (
    options: StartDungeonRunOptions,
  ) => E.Effect<void, DungeonRunDAOError>;

  readonly deleteHistoryByConfigurationDefinitionId: (
    options: DeleteHistoryByConfigurationDefinitionIdOptions,
  ) => E.Effect<void, DungeonRunDAOError>;
};

export class DungeonRunDAO extends Context.Service<
  DungeonRunDAO,
  DungeonRunDAOShape
>()(
  "fellowship-run-tracker/db/daos/dungeon-run/dungeon-run-dao/DungeonRunDAO",
) {}
