import * as Context from "effect/Context";
import type * as DateTime from "effect/DateTime";
import type * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as SqlError from "effect/unstable/sql/SqlError";

import { DungeonRunDAO } from "@/db/daos/dungeon-run/dungeon-run-dao.ts";
import { DungeonRunObservationDAO } from "@/db/daos/dungeon-run-observation/dungeon-run-observation-dao.ts";
import { LocalLogDungeonRunDAO } from "@/db/daos/local-log-dungeon-run/local-log-dungeon-run-dao.ts";
import { FellowshipLogsDungeonRunDAO } from "@/db/fellowship-logs-dungeon-run/fellowship-logs-dungeon-run-dao.ts";
import { type FellowshipLogsImportedDungeonRunRow } from "@/db/fellowship-logs-dungeon-run/fellowship-logs-imported-dungeon-run-row-schema.ts";
import { type DungeonRunModel } from "@/db/models/dungeon-run-model.ts";
import { type DungeonRunDAOError } from "@/errors/dungeon-run-dao-error.ts";
import { type DungeonRunObservationDAOError } from "@/errors/dungeon-run-observation-dao-error.ts";
import { type FellowshipLogsDungeonRunDAOError } from "@/errors/fellowship-logs-dungeon-run-dao-error.ts";
import { type LocalLogDungeonRunDAOError } from "@/errors/local-log-dungeon-run-dao-error.ts";
import { type RequirementTargetId } from "@/services/fellowship/requirements/requirement-lookup.ts";
import { type RequirementEventType } from "@/services/fellowship/validation/requirement-event-type-schema.ts";
import { type DungeonRunId } from "@/validation/dungeon-run/dungeon-run-id-schema.ts";
import { type FellowshipLogsFightId } from "@/validation/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { type FellowshipLogsReportCode } from "@/validation/fellowship-logs/fellowship-logs-report-code-schema.ts";

import { makeDungeonRunRepository } from "./make-dungeon-run-repository-service.ts";

export type DungeonRunRepositoryError =
  | DungeonRunDAOError
  | DungeonRunObservationDAOError
  | FellowshipLogsDungeonRunDAOError
  | LocalLogDungeonRunDAOError
  | SqlError.SqlError;

type DungeonRunHistoryOptions = {
  readonly dungeonId: DungeonRunModel["dungeonId"];
  readonly dungeonLevel: DungeonRunModel["dungeonLevel"];
};

type CreateLocalDungeonRunOptions = DungeonRunHistoryOptions;

type StartLocalDungeonRunOptions = {
  readonly dungeonRunId: DungeonRunId;
  readonly startedAt: DateTime.Utc;
};

type FinishLocalDungeonRunOptions = {
  readonly dungeonRunId: DungeonRunId;
  readonly endedAt: DateTime.Utc;
};

type DeleteDungeonRunOptions = {
  readonly dungeonRunId: DungeonRunId;
};

type ImportFellowshipLogsDungeonRunObservation = {
  readonly observedAt: DateTime.Utc;
  readonly targetId: RequirementTargetId;
  readonly type: RequirementEventType;
};

type ImportFellowshipLogsDungeonRunOptions = DungeonRunHistoryOptions & {
  readonly endedAt: DateTime.Utc;
  readonly fightId: FellowshipLogsFightId;
  readonly isOwnRun: boolean;
  readonly observations: ReadonlyArray<ImportFellowshipLogsDungeonRunObservation>;
  readonly reportCode: FellowshipLogsReportCode;
  readonly startedAt: DateTime.Utc;
};

export type DungeonRunRepositoryShape = {
  readonly completeLocal: (
    options: FinishLocalDungeonRunOptions,
  ) => E.Effect<void, DungeonRunRepositoryError>;

  readonly createLocal: (
    options: CreateLocalDungeonRunOptions,
  ) => E.Effect<DungeonRunModel, DungeonRunRepositoryError>;

  readonly delete: (
    options: DeleteDungeonRunOptions,
  ) => E.Effect<void, DungeonRunDAOError>;

  readonly deleteHistory: (
    options: DungeonRunHistoryOptions,
  ) => E.Effect<void, DungeonRunDAOError>;

  readonly exitLocal: (
    options: FinishLocalDungeonRunOptions,
  ) => E.Effect<void, DungeonRunRepositoryError>;

  readonly createFellowshipLogsDungeonRun: (
    options: ImportFellowshipLogsDungeonRunOptions,
  ) => E.Effect<DungeonRunModel, DungeonRunRepositoryError>;

  readonly interruptLocal: (
    options: FinishLocalDungeonRunOptions,
  ) => E.Effect<void, DungeonRunRepositoryError>;

  readonly listFellowshipLogsDungeonRuns: () => E.Effect<
    ReadonlyArray<FellowshipLogsImportedDungeonRunRow>,
    FellowshipLogsDungeonRunDAOError
  >;

  readonly startLocal: (
    options: StartLocalDungeonRunOptions,
  ) => E.Effect<void, DungeonRunDAOError>;
};

export class DungeonRunRepository extends Context.Service<
  DungeonRunRepository,
  DungeonRunRepositoryShape
>()(
  "fellowship-run-tracker/services/dungeon-run-repository/dungeon-run-repository-service/DungeonRunRepository",
) {
  static readonly layerNoDeps = Layer.effect(this, makeDungeonRunRepository);

  static readonly layer = this.layerNoDeps.pipe(
    Layer.provide(DungeonRunDAO.layer),
    Layer.provide(DungeonRunObservationDAO.layer),
    Layer.provide(FellowshipLogsDungeonRunDAO.layer),
    Layer.provide(LocalLogDungeonRunDAO.layer),
  );
}
