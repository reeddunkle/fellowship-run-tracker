import * as E from "effect/Effect";

import { DungeonRunRepository } from "@/services/dungeon-run-repository/dungeon-run-repository-service.ts";
import { FellowshipLogs } from "@/services/fellowship-logs/fellowship-logs-service.ts";

import { type FellowshipLogsDungeonRunImporterServiceShape } from "./fellowship-logs-dungeon-run-importer-service.ts";
import { processFellowshipLogsDungeonRun } from "./process-fellowship-logs-dungeon-run.ts";

export const makeFellowshipLogsDungeonRunImporter = E.gen(function* () {
  const dungeonRunRepository = yield* DungeonRunRepository;
  const fellowshipLogs = yield* FellowshipLogs;

  const importReport: FellowshipLogsDungeonRunImporterServiceShape["importReport"] =
    E.fn("FellowshipLogsDungeonRunImporter.importReport")(function* ({
      fightId,
      isOwnRun,
      reportCode,
    }) {
      const processedRun = yield* processFellowshipLogsDungeonRun({
        events: fellowshipLogs.streamEvents({
          fightId,
          reportCode,
        }),
        fightId,
        reportCode,
      });

      const dungeonRun =
        yield* dungeonRunRepository.createFellowshipLogsDungeonRun({
          dungeonId: processedRun.dungeonId,
          dungeonLevel: processedRun.dungeonLevel,
          endedAt: processedRun.endedAt,
          fightId,
          isOwnRun,
          observations: processedRun.observations.map((observation) => {
            return {
              observedAt: observation.timestamp,
              targetId: observation.targetId,
              type: observation.type,
            };
          }),
          reportCode,
          startedAt: processedRun.startedAt,
        });

      yield* E.logInfo("Imported Fellowship Logs dungeon run.", {
        dungeonId: processedRun.dungeonId,
        dungeonLevel: processedRun.dungeonLevel,
        dungeonRunId: dungeonRun.id,
        fightId,
        observationCount: processedRun.observations.length,
        reportCode,
      });

      return {
        dungeonRunId: dungeonRun.id,
      };
    });

  return {
    importReport,
  } satisfies FellowshipLogsDungeonRunImporterServiceShape;
});
