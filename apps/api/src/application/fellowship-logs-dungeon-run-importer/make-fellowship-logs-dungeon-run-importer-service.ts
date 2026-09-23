import * as E from "effect/Effect";
import * as Option from "effect/Option";

import { FellowshipLogsDungeonRunImportAlreadyImportedError } from "@frt/api/errors/fellowship-logs-dungeon-run-import-error.ts";
import { DungeonRunRepository } from "@frt/api/services/dungeon-run-repository/dungeon-run-repository-service.ts";
import { streamFellowshipLogsEvents } from "@frt/api/services/fellowship-logs/events/stream-fellowship-logs-events.ts";
import { FellowshipLogs } from "@frt/api/services/fellowship-logs/fellowship-logs-service.ts";
import { FellowshipLogsImportPageDAO } from "@frt/db/daos/fellowship-logs-import-page/fellowship-logs-import-page-dao.ts";

import { type FellowshipLogsDungeonRunImporterServiceShape } from "./fellowship-logs-dungeon-run-importer-service.ts";
import { processFellowshipLogsDungeonRun } from "./process-fellowship-logs-dungeon-run.ts";
import { streamResumableReportPages } from "./stream-resumable-report-pages.ts";

export const makeFellowshipLogsDungeonRunImporter = E.gen(function* () {
  const dungeonRunRepository = yield* DungeonRunRepository;
  const fellowshipLogs = yield* FellowshipLogs;
  const importPageDAO = yield* FellowshipLogsImportPageDAO;

  const importReport: FellowshipLogsDungeonRunImporterServiceShape["importReport"] =
    E.fn("FellowshipLogsDungeonRunImporter.importReport")(function* ({
      backgroundJobId,
      fightId,
      isOwnRun,
      onProgress,
      reportCode,
    }) {
      const existing = yield* dungeonRunRepository.getFellowshipLogsDungeonRun({
        fightId,
        reportCode,
      });

      if (Option.isSome(existing)) {
        return yield* new FellowshipLogsDungeonRunImportAlreadyImportedError({
          dungeonRunId: existing.value.dungeonRunId,
          fightId,
          reportCode,
        });
      }

      const reportPages =
        backgroundJobId === undefined
          ? fellowshipLogs.streamReportPages({
              fightId,
              reportCode,
              ...(onProgress === undefined ? {} : { onProgress }),
            })
          : yield* streamResumableReportPages({
              backgroundJobId,
              fightId,
              onProgress,
              reportCode,
            }).pipe(
              E.provideService(FellowshipLogs, fellowshipLogs),
              E.provideService(FellowshipLogsImportPageDAO, importPageDAO),
            );

      const processedRun = yield* processFellowshipLogsDungeonRun({
        events: streamFellowshipLogsEvents(reportPages),
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

      // The run is saved, so its pages won't be needed again. Failing to clear
      // them doesn't undo the import; they go when the job is pruned.
      if (backgroundJobId !== undefined) {
        yield* importPageDAO.deleteForJob({ backgroundJobId }).pipe(
          E.catch((error) => {
            return E.logWarning(
              "Failed to clear saved Fellowship Logs pages.",
              { error },
            );
          }),
        );
      }

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
