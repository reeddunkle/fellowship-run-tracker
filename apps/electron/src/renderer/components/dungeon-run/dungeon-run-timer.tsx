import { useEffect, useRef, useState } from "react";

import { cn } from "@frt/ui/class-names.ts";

import { formatDuration } from "@/renderer/components/dungeon-run/helpers/dungeon-run-time";

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

  const lastElapsedMillisecondsRef = useRef(elapsedMilliseconds);
  const wasRunningRef = useRef(false);

  useEffect(() => {
    if (initialElapsedMilliseconds === undefined) {
      lastElapsedMillisecondsRef.current = undefined;
      wasRunningRef.current = false;
      setElapsedMilliseconds(undefined);
      return;
    }

    if (!isRunning) {
      lastElapsedMillisecondsRef.current = initialElapsedMilliseconds;
      wasRunningRef.current = false;
      setElapsedMilliseconds(initialElapsedMilliseconds);
      return;
    }

    const isFreshStart = !wasRunningRef.current;

    wasRunningRef.current = true;

    const baselineElapsedMilliseconds = isFreshStart
      ? initialElapsedMilliseconds
      : Math.max(
          initialElapsedMilliseconds,
          lastElapsedMillisecondsRef.current ?? initialElapsedMilliseconds,
        );

    lastElapsedMillisecondsRef.current = baselineElapsedMilliseconds;
    setElapsedMilliseconds(baselineElapsedMilliseconds);

    const startedAt = performance.now();

    const intervalId = window.setInterval(() => {
      const elapsedSinceStart = performance.now() - startedAt;
      const nextElapsedMilliseconds = Math.floor(
        baselineElapsedMilliseconds + elapsedSinceStart,
      );

      lastElapsedMillisecondsRef.current = nextElapsedMilliseconds;
      setElapsedMilliseconds(nextElapsedMilliseconds);
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
