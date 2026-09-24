import * as Context from "effect/Context";
import type * as DateTime from "effect/DateTime";
import type * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as Option from "effect/Option";

import { makeLocalLogDungeonRunDAO } from "@frt/db/daos/local-log-dungeon-run/make-local-log-dungeon-run-dao.ts";
import { type LocalLogDungeonRunDAOError } from "@frt/db/errors/local-log-dungeon-run-dao-error.ts";
import { type LocalLogDungeonRunModel } from "@frt/db/models/local-log-dungeon-run-model.ts";
import { type DungeonRunId } from "@frt/shared/dungeon-run/dungeon-run-id-schema.ts";

type CreateLocalLogDungeonRunOptions = {
  readonly dungeonRunId: DungeonRunId;
};

type GetLocalLogDungeonRunByDungeonRunIdOptions = {
  readonly dungeonRunId: DungeonRunId;
};

type FinishLocalLogDungeonRunOptions = {
  readonly dungeonRunId: DungeonRunId;
};

type ListActiveLocalLogDungeonRunsOptions = {
  readonly createdBefore: DateTime.Utc;
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

  readonly listActive: (
    options: ListActiveLocalLogDungeonRunsOptions,
  ) => E.Effect<
    ReadonlyArray<LocalLogDungeonRunModel>,
    LocalLogDungeonRunDAOError
  >;
};

export class LocalLogDungeonRunDAO extends Context.Service<
  LocalLogDungeonRunDAO,
  LocalLogDungeonRunDAOShape
>()(
  "@frt/db/daos/local-log-dungeon-run/local-log-dungeon-run-dao/LocalLogDungeonRunDAO",
) {
  static readonly layer = Layer.effect(this, makeLocalLogDungeonRunDAO);
}
