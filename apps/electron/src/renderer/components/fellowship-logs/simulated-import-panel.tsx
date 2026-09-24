import * as DateTime from "effect/DateTime";
import { useRef, useState } from "react";

import { FellowshipLogsFightIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { FellowshipLogsReportCodeSchema } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";
import {
  makeSimulatedImportReportCode,
  type SimulatedImportOutcome,
} from "@frt/shared/fellowship-logs/simulated-import-report-code.ts";
import { Button } from "@frt/ui/button.tsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@frt/ui/card.tsx";
import { NativeSelect, NativeSelectOption } from "@frt/ui/native-select.tsx";

import { useQueueDungeonRunImport } from "@/renderer/api/fellowship-logs/fellowship-logs-mutations.ts";
import { useFellowshipDataStore } from "@/renderer/stores/fellowship-data/fellowship-data-store.tsx";

const DURATION_SECONDS_OPTIONS = [3, 8, 15] as const;

const MIXED_OUTCOMES: ReadonlyArray<SimulatedImportOutcome> = [
  "success",
  "failure",
  "rate-limited",
];

export function SimulatedImportPanel() {
  const [durationSeconds, setDurationSeconds] = useState<number>(
    DURATION_SECONDS_OPTIONS[1],
  );
  const queuedCountRef = useRef(0);

  const dungeons = useFellowshipDataStore((state) => state.dungeons);
  const { queueImport } = useQueueDungeonRunImport();

  function queueSimulatedImport(outcome: SimulatedImportOutcome) {
    const count = queuedCountRef.current;
    queuedCountRef.current = count + 1;

    const dungeon = dungeons[count % dungeons.length];

    if (dungeon === undefined) {
      return;
    }

    const nonce = `${DateTime.toEpochMillis(DateTime.nowUnsafe()).toString(36)}${count}`;

    queueImport({
      dungeonId: dungeon.id,
      dungeonLevel: 2 + (count % 19),
      fightId: FellowshipLogsFightIdSchema.make(1),
      isOwnRun: true,
      reportCode: FellowshipLogsReportCodeSchema.make(
        makeSimulatedImportReportCode({ durationSeconds, nonce, outcome }),
      ),
    });
  }

  return (
    <Card size="sm">
      <CardHeader>
        <CardTitle>Simulated imports (dev)</CardTitle>
        <CardDescription>
          Queues fake Fellowship Logs imports that run through the real job
          queue without contacting Fellowship Logs.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-wrap items-center gap-2">
        <NativeSelect
          aria-label="Simulated import duration"
          onChange={(event) => {
            setDurationSeconds(Number(event.target.value));
          }}
          value={durationSeconds}
        >
          {DURATION_SECONDS_OPTIONS.map((seconds) => (
            <NativeSelectOption key={seconds} value={seconds}>
              {seconds} seconds
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Button
          onClick={() => {
            queueSimulatedImport("success");
          }}
          type="button"
          variant="outline"
        >
          Queue success
        </Button>
        <Button
          onClick={() => {
            queueSimulatedImport("failure");
          }}
          type="button"
          variant="outline"
        >
          Queue failure
        </Button>
        <Button
          onClick={() => {
            queueSimulatedImport("rate-limited");
          }}
          type="button"
          variant="outline"
        >
          Queue rate-limited
        </Button>
        <Button
          onClick={() => {
            MIXED_OUTCOMES.forEach((outcome) => {
              queueSimulatedImport(outcome);
            });
          }}
          type="button"
          variant="outline"
        >
          Queue 3 mixed
        </Button>
      </CardContent>
    </Card>
  );
}
