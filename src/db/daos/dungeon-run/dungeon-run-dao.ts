import * as Context from "effect/Context";
import type * as E from "effect/Effect";
import type * as Option from "effect/Option";

import { type DungeonRunModel } from "@/db/models/dungeon-run-model.ts";
import { type DungeonRunDAOError } from "@/errors/dungeon-run-dao-error.ts";
import { type DungeonRunId } from "@/validation/dungeon-run/dungeon-run-id-schema.ts";

type GetDungeonRunByIdOptions = {
  readonly id: DungeonRunId;
};

type CreateDungeonRunOptions = {
  readonly dungeonId: DungeonRunModel["dungeonId"];
  readonly dungeonLevel: DungeonRunModel["dungeonLevel"];
  readonly endedAt: DungeonRunModel["endedAt"];
  readonly source: DungeonRunModel["source"];
  readonly startedAt: DungeonRunModel["startedAt"];
};

type DeleteDungeonRunOptions = {
  readonly dungeonRunId: DungeonRunId;
};

type DeleteDungeonRunsByDungeonOptions = {
  readonly dungeonId: DungeonRunModel["dungeonId"];
  readonly dungeonLevel: DungeonRunModel["dungeonLevel"];
};

type StartDungeonRunOptions = {
  readonly dungeonRunId: DungeonRunId;
  readonly startedAt: NonNullable<DungeonRunModel["startedAt"]>;
};

type EndDungeonRunOptions = {
  readonly dungeonRunId: DungeonRunId;
  readonly endedAt: NonNullable<DungeonRunModel["endedAt"]>;
};

export type DungeonRunDAOShape = {
  readonly create: (
    options: CreateDungeonRunOptions,
  ) => E.Effect<DungeonRunModel, DungeonRunDAOError>;

  readonly delete: (
    options: DeleteDungeonRunOptions,
  ) => E.Effect<void, DungeonRunDAOError>;

  readonly deleteByDungeon: (
    options: DeleteDungeonRunsByDungeonOptions,
  ) => E.Effect<void, DungeonRunDAOError>;

  readonly end: (
    options: EndDungeonRunOptions,
  ) => E.Effect<void, DungeonRunDAOError>;

  readonly getById: (
    options: GetDungeonRunByIdOptions,
  ) => E.Effect<Option.Option<DungeonRunModel>, DungeonRunDAOError>;

  readonly start: (
    options: StartDungeonRunOptions,
  ) => E.Effect<void, DungeonRunDAOError>;
};

export class DungeonRunDAO extends Context.Service<
  DungeonRunDAO,
  DungeonRunDAOShape
>()(
  "fellowship-run-tracker/db/daos/dungeon-run/dungeon-run-dao/DungeonRunDAO",
) {}
