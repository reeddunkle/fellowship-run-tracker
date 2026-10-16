import * as Context from "effect/Context";
import type * as DateTime from "effect/DateTime";
import type * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as Option from "effect/Option";
import type * as SqlError from "effect/sql/SqlError";

import { DungeonRunDAO } from "@frt/db/daos/dungeon-run/dungeon-run-dao.ts";
import {
  DungeonRunObservationDAO,
  type DungeonRunObservationHistory,
} from "@frt/db/daos/dungeon-run-observation/dungeon-run-observation-dao.ts";
import { FellowshipLogsDungeonRunDAO } from "@frt/db/daos/fellowship-logs-dungeon-run/fellowship-logs-dungeon-run-dao.ts";
import { type FellowshipLogsImportedDungeonRunRow } from "@frt/db/daos/fellowship-logs-dungeon-run/fellowship-logs-imported-dungeon-run-row-schema.ts";
import {
  type FinishedDungeonRunStatus,
  LocalLogDungeonRunDAO,
} from "@frt/db/daos/local-log-dungeon-run/local-log-dungeon-run-dao.ts";
import { type DungeonRunDAOError } from "@frt/db/errors/dungeon-run-dao-error.ts";
import { type DungeonRunObservationDAOError } from "@frt/db/errors/dungeon-run-observation-dao-error.ts";
import { type FellowshipLogsDungeonRunDAOError } from "@frt/db/errors/fellowship-logs-dungeon-run-dao-error.ts";
import { type LocalLogDungeonRunDAOError } from "@frt/db/errors/local-log-dungeon-run-dao-error.ts";
import { type DungeonRunModel } from "@frt/db/models/dungeon-run-model.ts";
import { type DungeonRunObservationModel } from "@frt/db/models/dungeon-run-observation-model.ts";
import { type FellowshipLogsDungeonRunModel } from "@frt/db/models/fellowship-logs-dungeon-run-model.ts";
import { makeDungeonRunStore } from "@frt/db/stores/dungeon-run/make-dungeon-run-store.ts";
import { type DungeonRunId } from "@frt/shared/dungeon-run/dungeon-run-id-schema.ts";
import { type DungeonRunStatus } from "@frt/shared/dungeon-run/dungeon-run-status-schema.ts";
import { type FellowshipLogsFightId } from "@frt/shared/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { type FellowshipLogsReportCode } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";

export type { DungeonRunObservationHistory } from "@frt/db/daos/dungeon-run-observation/dungeon-run-observation-dao.ts";
export type { FellowshipLogsImportedDungeonRunRow } from "@frt/db/daos/fellowship-logs-dungeon-run/fellowship-logs-imported-dungeon-run-row-schema.ts";
export type { FinishedDungeonRunStatus } from "@frt/db/daos/local-log-dungeon-run/local-log-dungeon-run-dao.ts";

export type DungeonRunStoreError =
  | DungeonRunDAOError
  | DungeonRunObservationDAOError
  | FellowshipLogsDungeonRunDAOError
  | LocalLogDungeonRunDAOError
  | SqlError.SqlError;

type DungeonRunHistoryOptions = {
  readonly dungeonId: DungeonRunModel["dungeonId"];
  readonly dungeonLevel: DungeonRunModel["dungeonLevel"];
};

type DungeonRunReference = {
  readonly dungeonRunId: DungeonRunId;
};

export type DungeonRunStoreObservation = {
  readonly observedAt: DungeonRunObservationModel["observedAt"];
  readonly targetId: DungeonRunObservationModel["targetId"];
  readonly type: DungeonRunObservationModel["type"];
};

type StartLocalDungeonRunOptions = DungeonRunReference & {
  readonly startedAt: DateTime.Utc;
};

type ObserveLocalDungeonRunOptions = DungeonRunReference & {
  readonly observations: ReadonlyArray<DungeonRunStoreObservation>;
};

type FinishLocalDungeonRunOptions = DungeonRunReference & {
  readonly endedAt: DateTime.Utc;
  readonly status: FinishedDungeonRunStatus;
};

type LocalDungeonRun = {
  readonly dungeonRun: DungeonRunModel;
  readonly status: DungeonRunStatus;
};

type FellowshipLogsDungeonRunReference = {
  readonly fightId: FellowshipLogsFightId;
  readonly reportCode: FellowshipLogsReportCode;
};

type ImportFellowshipLogsDungeonRunOptions = DungeonRunHistoryOptions &
  FellowshipLogsDungeonRunReference & {
    readonly endedAt: DateTime.Utc;
    readonly isOwnRun: boolean;
    readonly observations: ReadonlyArray<DungeonRunStoreObservation>;
    readonly startedAt: DateTime.Utc;
  };

export type DungeonRunStoreShape = {
  readonly createLocal: (
    options: DungeonRunHistoryOptions,
  ) => E.Effect<DungeonRunModel, DungeonRunStoreError>;

  readonly delete: (
    options: DungeonRunReference,
  ) => E.Effect<void, DungeonRunDAOError>;

  readonly deleteHistory: (
    options: DungeonRunHistoryOptions,
  ) => E.Effect<void, DungeonRunDAOError>;

  readonly finishLocal: (
    options: FinishLocalDungeonRunOptions,
  ) => E.Effect<void, DungeonRunStoreError>;

  readonly getFellowshipLogsRun: (
    options: FellowshipLogsDungeonRunReference,
  ) => E.Effect<
    Option.Option<FellowshipLogsDungeonRunModel>,
    FellowshipLogsDungeonRunDAOError
  >;

  readonly getHistory: (
    options: DungeonRunHistoryOptions,
  ) => E.Effect<
    ReadonlyArray<DungeonRunObservationHistory>,
    DungeonRunObservationDAOError
  >;

  readonly getLocal: (
    options: DungeonRunReference,
  ) => E.Effect<Option.Option<LocalDungeonRun>, DungeonRunStoreError>;

  readonly importFellowshipLogs: (
    options: ImportFellowshipLogsDungeonRunOptions,
  ) => E.Effect<DungeonRunModel, DungeonRunStoreError>;

  readonly interruptUnfinishedLocal: (options: {
    readonly createdBefore: DateTime.Utc;
  }) => E.Effect<ReadonlyArray<DungeonRunId>, DungeonRunStoreError>;

  readonly listFellowshipLogsRuns: () => E.Effect<
    ReadonlyArray<FellowshipLogsImportedDungeonRunRow>,
    FellowshipLogsDungeonRunDAOError
  >;

  readonly observeLocal: (
    options: ObserveLocalDungeonRunOptions,
  ) => E.Effect<void, DungeonRunStoreError>;

  readonly startLocal: (
    options: StartLocalDungeonRunOptions,
  ) => E.Effect<void, DungeonRunDAOError>;
};

export class DungeonRunStore extends Context.Service<
  DungeonRunStore,
  DungeonRunStoreShape
>()("@frt/db/stores/dungeon-run/dungeon-run-store/DungeonRunStore") {
  static readonly layerNoDeps = Layer.effect(this, makeDungeonRunStore);

  static readonly layer = this.layerNoDeps.pipe(
    Layer.provide(DungeonRunDAO.layer),
    Layer.provide(DungeonRunObservationDAO.layer),
    Layer.provide(FellowshipLogsDungeonRunDAO.layer),
    Layer.provide(LocalLogDungeonRunDAO.layer),
  );
}
