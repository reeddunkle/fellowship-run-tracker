import { Skeleton } from "@/electron/renderer/components/ui/skeleton.tsx";

type HistorySummaryMessageProps = {
  readonly emptyMessage: string;
  readonly runCount: number;
  readonly sampleCount: number;
};

export function HistorySummaryMessage({
  emptyMessage,
  runCount,
  sampleCount,
}: HistorySummaryMessageProps) {
  if (runCount === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }

  const sampleLabel = sampleCount === 1 ? "sample" : "samples";
  const runLabel = runCount === 1 ? "run" : "runs";

  return (
    <p className="text-sm text-muted-foreground">
      {sampleCount} historical {sampleLabel} across {runCount} tracked{" "}
      {runLabel}.
    </p>
  );
}

export function HistorySummaryMessageSkeleton() {
  return (
    <div className="grid gap-2 py-1">
      <Skeleton className="h-3 w-4/5" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
}
