import * as E from "effect/Effect";
import * as Option from "effect/Option";

import { FellowshipLogsDungeonRunImportAlreadyImportedError } from "@frt/api/errors/fellowship-logs-dungeon-run-import-error.ts";
import { DungeonRunRepository } from "@frt/api/services/dungeon-run-repository/dungeon-run-repository-service.ts";
import { streamFellowshipLogsGatewayEvents } from "@frt/api/services/fellowship-logs-gateway/events/stream-fellowship-logs-gateway-events.ts";
import { FellowshipLogsGateway } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-service.ts";

import { type FellowshipLogsDungeonRunImporterServiceShape } from "./fellowship-logs-dungeon-run-importer-service.ts";
import { processFellowshipLogsDungeonRun } from "./process-fellowship-logs-dungeon-run.ts";

export const makeFellowshipLogsDungeonRunImporter = E.gen(function* () {
  const dungeonRunRepository = yield* DungeonRunRepository;
  const fellowshipLogsGateway = yield* FellowshipLogsGateway;

  const importReport: FellowshipLogsDungeonRunImporterServiceShape["importReport"] =
    E.fn("FellowshipLogsDungeonRunImporter.importReport")(function* ({
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

      const reportPages = fellowshipLogsGateway.streamReportPages({
        fightId,
        reportCode,
        ...(onProgress === undefined ? {} : { onProgress }),
      });

      const processedRun = yield* processFellowshipLogsDungeonRun({
        events: streamFellowshipLogsGatewayEvents(reportPages),
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
