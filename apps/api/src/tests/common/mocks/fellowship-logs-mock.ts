import * as Layer from "effect/Layer";

import {
  FellowshipLogs,
  type FellowshipLogsShape,
} from "@frt/api/services/fellowship-logs/fellowship-logs-service.ts";
import { unexpectedEffectCall } from "@frt/api/tests/common/mocks/unexpected-service-call.ts";

export type MakeFellowshipLogsMockOptions = Partial<FellowshipLogsShape>;

export function makeFellowshipLogsMock({
  deleteImportedDungeonRun = unexpectedEffectCall(
    "FellowshipLogs",
    "deleteImportedDungeonRun",
  ),
  getAnalyticsSummary = unexpectedEffectCall(
    "FellowshipLogs",
    "getAnalyticsSummary",
  ),
  getDungeonRunMetadata = unexpectedEffectCall(
    "FellowshipLogs",
    "getDungeonRunMetadata",
  ),
  getImportCostEstimate = unexpectedEffectCall(
    "FellowshipLogs",
    "getImportCostEstimate",
  ),
  getImportedDungeonRuns = unexpectedEffectCall(
    "FellowshipLogs",
    "getImportedDungeonRuns",
  ),
  getPointPools = unexpectedEffectCall("FellowshipLogs", "getPointPools"),
  getRateLimitData = unexpectedEffectCall("FellowshipLogs", "getRateLimitData"),
  queueDungeonRunImport = unexpectedEffectCall(
    "FellowshipLogs",
    "queueDungeonRunImport",
  ),
  resumeImportJobWithCurrentConnection = unexpectedEffectCall(
    "FellowshipLogs",
    "resumeImportJobWithCurrentConnection",
  ),
}: MakeFellowshipLogsMockOptions = {}) {
  return Layer.succeed(FellowshipLogs, {
    deleteImportedDungeonRun,
    getAnalyticsSummary,
    getDungeonRunMetadata,
    getImportCostEstimate,
    getImportedDungeonRuns,
    getPointPools,
    getRateLimitData,
    queueDungeonRunImport,
    resumeImportJobWithCurrentConnection,
  } satisfies FellowshipLogsShape);
}

export const FellowshipLogsMock = makeFellowshipLogsMock();
