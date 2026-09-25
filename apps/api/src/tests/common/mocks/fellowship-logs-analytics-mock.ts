import * as E from "effect/Effect";

import { type FellowshipLogsAnalyticsShape } from "@frt/api/services/fellowship-logs-analytics/fellowship-logs-analytics-service.ts";

export const ignoredFellowshipLogsAnalytics: FellowshipLogsAnalyticsShape = {
  getSummary: () => {
    return E.die("unexpected call: FellowshipLogsAnalytics.getSummary");
  },
  record: () => {
    return E.void;
  },
};
