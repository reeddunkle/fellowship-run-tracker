import * as R from "effect/Record";
import { CheckIcon, XIcon } from "lucide-react";

import { Button } from "@/electron/renderer/components/ui/button.tsx";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/electron/renderer/components/ui/card.tsx";
import { Spinner } from "@/electron/renderer/components/ui/spinner.tsx";
import { type DungeonApiDungeonList } from "@/services/api/dungeon/dungeon-api-schema.ts";
import {
  type FellowshipLogsApiDungeonRunMetadata,
  type FellowshipLogsApiDungeonRunReference,
} from "@/services/api/fellowship-logs/fellowship-logs-api-schema.ts";

function formatDuration(
  startedAtMilliseconds: number,
  endedAtMilliseconds: number,
): string {
  const totalSeconds = Math.round(
    (endedAtMilliseconds - startedAtMilliseconds) / 1000,
  );
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

type ImportConfirmationCardProps = {
  readonly dungeons: DungeonApiDungeonList;
  readonly error: unknown;
  readonly isImporting: boolean;
  readonly metadata: FellowshipLogsApiDungeonRunMetadata;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
  readonly reference: FellowshipLogsApiDungeonRunReference;
};

export function ImportConfirmationCard({
  dungeons,
  error,
  isImporting,
  metadata,
  onCancel,
  onConfirm,
  reference,
}: ImportConfirmationCardProps) {
  const dungeonsById = R.fromIterableBy(dungeons, (dungeon) => {
    return dungeon.id;
  });

  const dungeonName =
    dungeonsById[metadata.dungeonId]?.name ?? metadata.dungeonId;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Confirm import</CardTitle>
      </CardHeader>
      <CardContent className="grid gap-4">
        <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <dt className="text-muted-foreground">Dungeon</dt>
            <dd className="font-medium">{dungeonName}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Level</dt>
            <dd className="font-medium">{metadata.dungeonLevel}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Duration</dt>
            <dd className="font-medium">
              {formatDuration(
                metadata.startedAtMilliseconds,
                metadata.endedAtMilliseconds,
              )}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Report / fight</dt>
            <dd className="font-medium">
              {reference.reportCode} / {reference.fightId}
            </dd>
          </div>
        </dl>
        <div className="flex items-center gap-3">
          <Button disabled={isImporting} onClick={onConfirm} type="button">
            {isImporting ? <Spinner /> : <CheckIcon />}
            {isImporting ? "Importing..." : "Import"}
          </Button>
          <Button
            disabled={isImporting}
            onClick={onCancel}
            type="button"
            variant="outline"
          >
            <XIcon />
            Cancel
          </Button>
          {error !== undefined ? (
            <p className="text-sm text-destructive">
              Failed to import this run.
            </p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
