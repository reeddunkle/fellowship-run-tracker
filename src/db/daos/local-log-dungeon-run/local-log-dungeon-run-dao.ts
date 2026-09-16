import * as Context from "effect/Context";
import type * as E from "effect/Effect";
import type * as Option from "effect/Option";

import { type LocalLogDungeonRunModel } from "@/db/models/local-log-dungeon-run-model.ts";
import { type LocalLogDungeonRunDAOError } from "@/errors/local-log-dungeon-run-dao-error.ts";
import { type DungeonRunId } from "@/validation/dungeon-run/dungeon-run-id-schema.ts";

type CreateLocalLogDungeonRunOptions = {
  readonly dungeonRunId: DungeonRunId;
};

type GetLocalLogDungeonRunByDungeonRunIdOptions = {
  readonly dungeonRunId: DungeonRunId;
};

type FinishLocalLogDungeonRunOptions = {
  readonly dungeonRunId: DungeonRunId;
};

export type LocalLogDungeonRunDAOShape = {
  readonly complete: (
    options: FinishLocalLogDungeonRunOptions,
  ) => E.Effect<void, LocalLogDungeonRunDAOError>;

  readonly create: (
    options: CreateLocalLogDungeonRunOptions,
  ) => E.Effect<LocalLogDungeonRunModel, LocalLogDungeonRunDAOError>;

  readonly exit: (
    options: FinishLocalLogDungeonRunOptions,
  ) => E.Effect<void, LocalLogDungeonRunDAOError>;

  readonly getByDungeonRunId: (
    options: GetLocalLogDungeonRunByDungeonRunIdOptions,
  ) => E.Effect<
    Option.Option<LocalLogDungeonRunModel>,
    LocalLogDungeonRunDAOError
  >;

  readonly interrupt: (
    options: FinishLocalLogDungeonRunOptions,
  ) => E.Effect<void, LocalLogDungeonRunDAOError>;
};

export class LocalLogDungeonRunDAO extends Context.Service<
  LocalLogDungeonRunDAO,
  LocalLogDungeonRunDAOShape
>()(
  "fellowship-run-tracker/db/daos/local-log-dungeon-run/local-log-dungeon-run-dao/LocalLogDungeonRunDAO",
) {}
