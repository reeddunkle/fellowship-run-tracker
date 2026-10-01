import * as A from "effect/Array";
import {
  ChevronsDownUpIcon,
  ChevronsUpDownIcon,
  SquareDashedBottomIcon,
} from "lucide-react";
import { useMemo } from "react";

import { EmptyState } from "@frt/ui/composites/empty-state.tsx";
import {
  TimingTableHeaderRow,
  TimingTableLabelHead,
} from "@frt/ui/composites/timing-table.tsx";
import { Button } from "@frt/ui/primitives/button.tsx";
import { Separator } from "@frt/ui/primitives/separator.tsx";

import { useDetachedWindow } from "@/renderer/components/detached-window/detached-window-provider.tsx";
import { DungeonRunDropdownMenu } from "@/renderer/components/dungeon-run/dungeon-run-dropdown-menu.tsx";
import { DungeonRunTimer } from "@/renderer/components/dungeon-run/dungeon-run-timer.tsx";
import { getDungeonRunComparisonGroupLabel } from "@/renderer/components/dungeon-run/helpers/dungeon-run-comparison-group.ts";
import { createDungeonRunMilestoneRows } from "@/renderer/components/dungeon-run/helpers/dungeon-run-milestone-rows.ts";
import { createDungeonRunTableRows } from "@/renderer/components/dungeon-run/helpers/dungeon-run-table-row.ts";
import { DungeonRunMilestone } from "@/renderer/components/dungeon-run/table/dungeon-run-milestone.tsx";
import {
  DungeonRunTable,
  DungeonRunTableTimeHeaders,
} from "@/renderer/components/dungeon-run/table/dungeon-run-table.tsx";
import { TrackingStartStopButtons } from "@/renderer/components/tracking/tracking-start-stop-buttons.tsx";
import {
  useConfigurationById,
  useSelectedConfigurationId,
} from "@/renderer/stores/configuration/configuration-provider.tsx";
import {
  useDungeonRunDisplayState,
  useDungeonRunInterpretationState,
  useDungeonRunServerState,
} from "@/renderer/stores/dungeon-run/dungeon-run-provider.tsx";
import { useTrackingServerState } from "@/renderer/stores/tracking/tracking-provider.tsx";
import { isNil } from "@/util/is-nil.ts";

export function DungeonRun() {
  const { resizeToContent } = useDetachedWindow();
  const selectedConfigurationId = useSelectedConfigurationId();

  const { collapseAllMilestones, expandAllMilestones, isMilestoneExpanded } =
    useDungeonRunDisplayState();

  const { trackingStatus } = useTrackingServerState();
  const { comparisonGroup, dungeonRun } = useDungeonRunServerState();
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
      <EmptyState className="min-h-40" variant="outline">
        Select a configuration to view dungeon run data.
      </EmptyState>
    );
  }

  const isActiveRun = dungeonRun?.status === "ACTIVE";

  const isTimerRunning = isActiveRun;

  const timerStartTimeMilliseconds = isNil(dungeonRun?.startedAtMilliseconds)
    ? undefined
    : latestObservation === undefined
      ? isTimerRunning
        ? 0
        : undefined
      : latestObservation.observation.timestampMilliseconds -
        dungeonRun.startedAtMilliseconds;

  return (
    <section className="grid min-w-105 w-full gap-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Button
            aria-label="Resize window to its contents"
            onClick={resizeToContent}
            size="icon"
            title="Resize window to its contents"
            variant="outline"
          >
            <SquareDashedBottomIcon />
          </Button>
        </div>
        <div className="flex items-center gap-2">
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
          <DungeonRunDropdownMenu />
        </div>
      </div>
      <header className="grid text-2xl w-full gap-1">
        <h2 className="truncate font-semibold">{configuration.label}</h2>
        <p className="text-sm text-muted-foreground">
          Comparing against:{" "}
          {getDungeonRunComparisonGroupLabel(comparisonGroup)}
        </p>
      </header>
      <DungeonRunTable rows={tableRows}>
        <thead>
          <TimingTableHeaderRow>
            <TimingTableLabelHead>Milestone</TimingTableLabelHead>
            <DungeonRunTableTimeHeaders />
          </TimingTableHeaderRow>
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
      <div className="justify-self-end text-end">
        <DungeonRunTimer
          initialElapsedMilliseconds={timerStartTimeMilliseconds}
          isRunning={isTimerRunning}
        />
      </div>
      <TrackingStartStopButtons />
    </section>
  );
}
