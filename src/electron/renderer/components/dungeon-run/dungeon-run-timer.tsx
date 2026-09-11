import { useEffect, useState } from "react";

import { formatDuration } from "@/electron/renderer/components/dungeon-run/helpers/dungeon-run-time";
import { cn } from "@/util/class-names.ts";

const TIMER_INTERVAL_MILLISECONDS = 1000 / 30;

type DungeonRunTimerProps = {
  className?: string;
  readonly initialElapsedMilliseconds: number | undefined;
  readonly isRunning: boolean;
};

function useElapsedTimer({
  initialElapsedMilliseconds,
  isRunning,
}: DungeonRunTimerProps): number | undefined {
  const [elapsedMilliseconds, setElapsedMilliseconds] = useState(
    initialElapsedMilliseconds,
  );

  useEffect(() => {
    if (initialElapsedMilliseconds === undefined) {
      setElapsedMilliseconds(undefined);
      return;
    }

    setElapsedMilliseconds(initialElapsedMilliseconds);

    if (!isRunning) {
      return;
    }

    const startedAt = performance.now();

    const intervalId = window.setInterval(() => {
      const elapsedSinceStart = performance.now() - startedAt;

      setElapsedMilliseconds(
        Math.floor(initialElapsedMilliseconds + elapsedSinceStart),
      );
    }, TIMER_INTERVAL_MILLISECONDS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [initialElapsedMilliseconds, isRunning]);

  return elapsedMilliseconds;
}

export function DungeonRunTimer({
  className,
  initialElapsedMilliseconds,
  isRunning,
}: DungeonRunTimerProps) {
  const elapsedMilliseconds = useElapsedTimer({
    initialElapsedMilliseconds,
    isRunning,
  });

  return (
    <div
      className={cn("font-mono text-5xl font-semibold tabular-nums", className)}
    >
      {formatDuration(elapsedMilliseconds)}
    </div>
  );
}
