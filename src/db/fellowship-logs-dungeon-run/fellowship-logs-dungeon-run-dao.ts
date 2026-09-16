import * as Context from "effect/Context";
import type * as E from "effect/Effect";
import type * as Option from "effect/Option";

import { type FellowshipLogsImportedDungeonRunRow } from "@/db/fellowship-logs-dungeon-run/fellowship-logs-imported-dungeon-run-row-schema.ts";
import { type FellowshipLogsDungeonRunModel } from "@/db/models/fellowship-logs-dungeon-run-model.ts";
import { type FellowshipLogsDungeonRunDAOError } from "@/errors/fellowship-logs-dungeon-run-dao-error.ts";
import { type DungeonRunId } from "@/validation/dungeon-run/dungeon-run-id-schema.ts";
import { type FellowshipLogsFightId } from "@/validation/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { type FellowshipLogsReportCode } from "@/validation/fellowship-logs/fellowship-logs-report-code-schema.ts";

type CreateFellowshipLogsDungeonRunOptions = {
  readonly dungeonRunId: DungeonRunId;
  readonly fightId: FellowshipLogsFightId;
  readonly reportCode: FellowshipLogsReportCode;
};

type GetFellowshipLogsDungeonRunByDungeonRunIdOptions = {
  readonly dungeonRunId: DungeonRunId;
};

type GetFellowshipLogsDungeonRunByReportFightOptions = {
  readonly fightId: FellowshipLogsFightId;
  readonly reportCode: FellowshipLogsReportCode;
};

export type FellowshipLogsDungeonRunDAOShape = {
  readonly create: (
    options: CreateFellowshipLogsDungeonRunOptions,
  ) => E.Effect<
    FellowshipLogsDungeonRunModel,
    FellowshipLogsDungeonRunDAOError
  >;

  readonly getByDungeonRunId: (
    options: GetFellowshipLogsDungeonRunByDungeonRunIdOptions,
  ) => E.Effect<
    Option.Option<FellowshipLogsDungeonRunModel>,
    FellowshipLogsDungeonRunDAOError
  >;

  readonly getByReportFight: (
    options: GetFellowshipLogsDungeonRunByReportFightOptions,
  ) => E.Effect<
    Option.Option<FellowshipLogsDungeonRunModel>,
    FellowshipLogsDungeonRunDAOError
  >;

  readonly listImported: () => E.Effect<
    ReadonlyArray<FellowshipLogsImportedDungeonRunRow>,
    FellowshipLogsDungeonRunDAOError
  >;
};

export class FellowshipLogsDungeonRunDAO extends Context.Service<
  FellowshipLogsDungeonRunDAO,
  FellowshipLogsDungeonRunDAOShape
>()(
  "fellowship-run-tracker/db/fellowship-logs-dungeon-run/fellowship-logs-dungeon-run-dao/FellowshipLogsDungeonRunDAO",
) {}
