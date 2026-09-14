import * as A from "effect/Array";
import {
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  MenuIcon,
  PlayIcon,
  SquareDashedBottomIcon,
  SquareIcon,
} from "lucide-react";
import { useMemo } from "react";

import { useDetachedWindow } from "@/electron/renderer/components/detached-window/detached-window-provider.tsx";
import { DungeonRunDropdownMenu } from "@/electron/renderer/components/dungeon-run/dungeon-run-dropdown-menu.tsx";
import { DungeonRunTimer } from "@/electron/renderer/components/dungeon-run/dungeon-run-timer.tsx";
import { createDungeonRunMilestoneRows } from "@/electron/renderer/components/dungeon-run/helpers/dungeon-run-milestone-rows.ts";
import { createDungeonRunTableRows } from "@/electron/renderer/components/dungeon-run/helpers/dungeon-run-table-row.ts";
import { DungeonRunMilestone } from "@/electron/renderer/components/dungeon-run/table/dungeon-run-milestone.tsx";
import {
  DungeonRunTable,
  DungeonRunTableTimeHeaders,
  DungeonRunTableTr,
} from "@/electron/renderer/components/dungeon-run/table/dungeon-run-table.tsx";
import { Button } from "@/electron/renderer/components/ui/button.tsx";
import {
  DropdownMenu,
  DropdownMenuTrigger,
} from "@/electron/renderer/components/ui/dropdown-menu.tsx";
import { Separator } from "@/electron/renderer/components/ui/separator.tsx";
import { Spinner } from "@/electron/renderer/components/ui/spinner.tsx";
import {
  useConfigurationById,
  useSelectedConfigurationId,
} from "@/electron/renderer/stores/configurations-store/configurations-store.tsx";
import {
  useDungeonRunDisplayState,
  useDungeonRunInterpretationState,
  useDungeonRunServerState,
} from "@/electron/renderer/stores/dungeon-run-store/dungeon-run-provider.tsx";
import {
  useTrackingActionState,
  useTrackingActions,
  useTrackingServerState,
} from "@/electron/renderer/stores/tracking-store/tracking-store.tsx";
import { isNil } from "@/util/is-nil.ts";

export function DungeonRun() {
  const { resizeToContent } = useDetachedWindow();
  const selectedConfigurationId = useSelectedConfigurationId();

  const { collapseAllMilestones, expandAllMilestones, isMilestoneExpanded } =
    useDungeonRunDisplayState();

  const { trackingStatus } = useTrackingServerState();
  const { start, stop } = useTrackingActions();
  const { isPending } = useTrackingActionState();
  const { dungeonRun } = useDungeonRunServerState();
  const { latestObservation, observations } =
    useDungeonRunInterpretationState();

  const trackedConfigurationId =
    trackingStatus?.status === "Tracking" &&
    trackingStatus.source.type === "Persisted"
      ? trackingStatus.source.configurationId
      : undefined;

  const configurationId = trackedConfigurationId ?? selectedConfigurationId;

  const configuration = useConfigurationById(configurationId);

  const milestoneRows = useMemo(() => {
    if (configuration === undefined) {
      return [];
    }

    return createDungeonRunMilestoneRows({
      milestones: configuration.milestones,
      observations,
      startedAtMilliseconds: dungeonRun?.startedAtMilliseconds ?? undefined,
    });
  }, [configuration, dungeonRun?.startedAtMilliseconds, observations]);
  const tableRows = useMemo(() => {
    return createDungeonRunTableRows(milestoneRows);
  }, [milestoneRows]);

  const areAllMilestonesExpanded =
    tableRows.length > 0 &&
    A.every(tableRows, (tableRow) => {
      return isMilestoneExpanded(String(tableRow.milestone.milestoneIndex));
    });

  if (configuration === undefined) {
    return (
      <div className="flex min-h-40 items-center justify-center rounded-lg border border-dashed text-sm text-muted-foreground">
        Select a configuration to view dungeon run data.
      </div>
    );
  }

  const isTracking = trackingStatus?.status === "Tracking";
  const isWaitingForFile = trackingStatus?.status === "WaitingForLogFile";

  const isTimerRunning = dungeonRun?.status === "ACTIVE";

  const timerStartTimeMilliseconds = isNil(dungeonRun?.startedAtMilliseconds)
    ? undefined
    : latestObservation === undefined
      ? isTimerRunning
        ? 0
        : undefined
      : latestObservation.observation.timestampMilliseconds -
        dungeonRun.startedAtMilliseconds;

  return (
    <section className="grid min-w-105 w-fit gap-3">
      <div className="flex items-center justify-end gap-2">
        <Button
          onClick={
            areAllMilestonesExpanded
              ? collapseAllMilestones
              : expandAllMilestones
          }
          size="icon"
          title={
            areAllMilestonesExpanded
              ? "Collapse all milestones"
              : "Expand all milestones"
          }
          variant="outline"
        >
          {areAllMilestonesExpanded ? (
            <ChevronsDownUpIcon />
          ) : (
            <ChevronsUpDownIcon />
          )}
        </Button>
        <Button onClick={resizeToContent} size="icon" variant="outline">
          <SquareDashedBottomIcon />
        </Button>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger
            render={
              <Button size="icon" variant="outline">
                <MenuIcon />
              </Button>
            }
          />
          <DungeonRunDropdownMenu />
        </DropdownMenu>
      </div>
      <header className="grid text-2xl w-full gap-1">
        <h2 className="truncate font-semibold">{configuration.label}</h2>
      </header>
      <DungeonRunTable rows={tableRows}>
        <thead>
          <DungeonRunTableTr className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <th className="px-3 text-left font-medium" scope="col">
              Milestone
            </th>
            <DungeonRunTableTimeHeaders />
          </DungeonRunTableTr>
        </thead>
        {A.map(tableRows, (tableRow) => {
          return (
            <DungeonRunMilestone
              key={`${configuration.id}:${tableRow.milestone.milestoneIndex}`}
              row={tableRow}
            />
          );
        })}
      </DungeonRunTable>
      <Separator />
      <DungeonRunTimer
        className="justify-self-end text-end"
        initialElapsedMilliseconds={timerStartTimeMilliseconds}
        isRunning={isTimerRunning}
      />
      <Button
        className="min-w-32 bg-green-600 text-white hover:bg-green-700"
        disabled={
          selectedConfigurationId === null ||
          isTracking ||
          isPending ||
          isWaitingForFile
        }
        onClick={() => {
          if (selectedConfigurationId === null) {
            return;
          }

          start(selectedConfigurationId);
        }}
        size="xl"
        type="button"
      >
        {isTracking ? (
          <>
            <Spinner className="size-6" />
            Tracking
          </>
        ) : (
          <>
            <PlayIcon className="fill-current" />
            Start
          </>
        )}
      </Button>
      <Button
        className="min-w-32"
        disabled={!isTracking || isPending}
        onClick={stop}
        size="xl"
        type="button"
        variant="destructive"
      >
        <SquareIcon className="fill-current" />
        Stop
      </Button>
    </section>
  );
}
