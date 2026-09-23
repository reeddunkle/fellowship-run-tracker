import { getRateLimitRefreshErrorMessage } from "@/renderer/api/fellowship-logs/fellowship-logs-rate-limit-messages.ts";
import { useNowMilliseconds } from "@/renderer/api/fellowship-logs/use-fellowship-logs-rate-limit-status.ts";

/** Explains why looking up the rate limit failed, with a live countdown. */
export function FellowshipLogsRateLimitRefreshErrorMessage({
  error,
}: {
  readonly error: unknown;
}) {
  const nowMilliseconds = useNowMilliseconds();

  return <>{getRateLimitRefreshErrorMessage(error, nowMilliseconds)}</>;
}
