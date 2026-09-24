import * as Context from "effect/Context";
import type * as E from "effect/Effect";
import * as Layer from "effect/Layer";

import { makeDungeonRunObservationDAO } from "@frt/db/daos/dungeon-run-observation/make-dungeon-run-observation-dao.ts";
import { type DungeonRunObservationDAOError } from "@frt/db/errors/dungeon-run-observation-dao-error.ts";
import { type DungeonRunModel } from "@frt/db/models/dungeon-run-model.ts";
import { type DungeonRunObservationModel } from "@frt/db/models/dungeon-run-observation-model.ts";
import { type DungeonRunId } from "@frt/shared/dungeon-run/dungeon-run-id-schema.ts";

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
  readonly dungeonRunId: DungeonRunObservationModel["dungeonRunId"];
  readonly elapsedMilliseconds: number;
  readonly isOwnRun: DungeonRunModel["isOwnRun"];
  readonly occurrence: number;
  readonly targetId: DungeonRunObservationModel["targetId"];
  readonly type: DungeonRunObservationModel["type"];
};

type GetDungeonRunObservationHistoryOptions = {
  readonly dungeonId: DungeonRunModel["dungeonId"];
  readonly dungeonLevel: DungeonRunModel["dungeonLevel"];
};

export type DungeonRunObservationDAOShape = {
  readonly getByDungeonRunId: (
    options: GetDungeonRunObservationsOptions,
  ) => E.Effect<
    ReadonlyArray<DungeonRunObservationModel>,
    DungeonRunObservationDAOError
  >;

  readonly getHistoryByDungeon: (
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
  "@frt/db/daos/dungeon-run-observation/dungeon-run-observation-dao/DungeonRunObservationDAO",
) {
  static readonly layer = Layer.effect(this, makeDungeonRunObservationDAO);
}
