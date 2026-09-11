import * as Context from "effect/Context";
import type * as E from "effect/Effect";

import { type DungeonRunObservationModel } from "@/db/models/dungeon-run-observation-model.ts";
import { type DungeonRunObservationDAOError } from "@/errors/dungeon-run-observation-dao-error.ts";
import { type ConfigurationDefinitionId } from "@/validation/configuration/configuration-definition-id-schema.ts";
import { type DungeonRunId } from "@/validation/dungeon-run/dungeon-run-id-schema.ts";

type ObserveDungeonRunOptions = {
  readonly dungeonRunId: DungeonRunId;
  readonly observedAt: DungeonRunObservationModel["observedAt"];
  readonly targetId: DungeonRunObservationModel["targetId"];
  readonly type: DungeonRunObservationModel["type"];
};

type GetDungeonRunObservationsOptions = {
  readonly dungeonRunId: DungeonRunId;
};

export type DungeonRunObservationHistory = {
  readonly elapsedMilliseconds: number;
  readonly occurrence: number;
  readonly targetId: DungeonRunObservationModel["targetId"];
  readonly type: DungeonRunObservationModel["type"];
};

type GetDungeonRunObservationHistoryOptions = {
  readonly configurationDefinitionId: ConfigurationDefinitionId;
};

export type DungeonRunObservationDAOShape = {
  readonly getByDungeonRunId: (
    options: GetDungeonRunObservationsOptions,
  ) => E.Effect<
    ReadonlyArray<DungeonRunObservationModel>,
    DungeonRunObservationDAOError
  >;

  readonly getHistoryByConfigurationDefinitionId: (
    options: GetDungeonRunObservationHistoryOptions,
  ) => E.Effect<
    ReadonlyArray<DungeonRunObservationHistory>,
    DungeonRunObservationDAOError
  >;

  readonly observe: (
    options: ObserveDungeonRunOptions,
  ) => E.Effect<void, DungeonRunObservationDAOError>;
};

export class DungeonRunObservationDAO extends Context.Service<
  DungeonRunObservationDAO,
  DungeonRunObservationDAOShape
>()(
  "fellowship-run-tracker/db/daos/dungeon-run-observation/dungeon-run-observation-dao/DungeonRunObservationDAO",
) {}
