import { type FellowshipLogsResponseCacheShape } from "@frt/api/services/fellowship-logs/cache/fellowship-logs-response-cache-service.ts";

export const passThroughFellowshipLogsResponseCache: FellowshipLogsResponseCacheShape =
  {
    cached: (_request, fetch) => {
      return fetch;
    },
  };
