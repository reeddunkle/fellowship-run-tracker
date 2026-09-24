import { getRateLimitRefreshErrorMessage } from "@/renderer/api/fellowship-logs/fellowship-logs-rate-limit-messages.ts";
import { useNowMilliseconds } from "@/renderer/stores/clock/use-now-milliseconds.ts";

export function FellowshipLogsRateLimitRefreshErrorMessage({
  error,
}: {
  readonly error: unknown;
}) {
  const nowMilliseconds = useNowMilliseconds();

  return <>{getRateLimitRefreshErrorMessage(error, nowMilliseconds)}</>;
}
