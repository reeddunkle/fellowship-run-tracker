import { type FellowshipLogsGatewayResponseCacheShape } from "@frt/api/services/fellowship-logs-gateway/cache/fellowship-logs-gateway-response-cache-service.ts";

export const passThroughFellowshipLogsGatewayResponseCache: FellowshipLogsGatewayResponseCacheShape =
  {
    cached: (_request, fetch) => {
      return fetch;
    },
  };
