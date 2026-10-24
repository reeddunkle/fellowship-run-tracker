import * as E from "effect/Effect";
import * as Layer from "effect/Layer";

import { EMPTY_FELLOWSHIP_LOGS_GATEWAY_WORKFLOW_COST } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-points-spent.ts";
import {
  FellowshipLogsImportCost,
  type FellowshipLogsImportCostShape,
} from "@frt/api/services/fellowship-logs-import-cost/fellowship-logs-import-cost-service.ts";

const ignoredFellowshipLogsImportCost: FellowshipLogsImportCostShape = {
  claimLookupWorkflow: () => E.succeedNone,
  getEstimate: () => {
    return E.die("unexpected call: FellowshipLogsImportCost.getEstimate");
  },
  measure: () => (effect) => {
    return effect.pipe(
      E.map((result) => {
        return [result, EMPTY_FELLOWSHIP_LOGS_GATEWAY_WORKFLOW_COST] as const;
      }),
    );
  },
  recordLookupWorkflow: () => {
    return E.die(
      "unexpected call: FellowshipLogsImportCost.recordLookupWorkflow",
    );
  },
};

export const IgnoredFellowshipLogsImportCostLayer = Layer.succeed(
  FellowshipLogsImportCost,
  ignoredFellowshipLogsImportCost,
);
