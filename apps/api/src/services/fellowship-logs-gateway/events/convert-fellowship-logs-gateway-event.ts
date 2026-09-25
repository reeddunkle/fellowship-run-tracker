import * as DateTime from "effect/DateTime";
import * as Match from "effect/Match";

import { type FellowshipLogsGatewayConvertibleEvent } from "@frt/api/services/fellowship-logs-gateway/validation/fellowship-logs-gateway-event-schema.ts";
import { type FellowshipLogsGatewayReport } from "@frt/api/services/fellowship-logs-gateway/validation/fellowship-logs-gateway-report-schema.ts";
import { FELLOWSHIP_EVENT } from "@frt/shared/fellowship/constants/fellowship-event.ts";
import { type DungeonStartEvent } from "@frt/shared/fellowship/validation/events/dungeon-start.ts";
import { getDungeonLevelFromAbsoluteDungeonLevel } from "@frt/shared/fellowship/validation/fellowship-common.ts";
import { type FellowshipEvent } from "@frt/shared/fellowship/validation/fellowship-event-schema.ts";

type FellowshipLogsGatewayReportActor = NonNullable<
  FellowshipLogsGatewayReport["masterData"]["actors"]
>[number];

type ConvertFellowshipLogsEventOptions = {
  readonly actors: ReadonlyArray<FellowshipLogsGatewayReportActor>;
  readonly dungeonStartEvent: DungeonStartEvent | undefined;
  readonly event: FellowshipLogsGatewayConvertibleEvent;
  readonly reportStartTime: number;
};

function getActorById({
  actorId,
  actors,
}: {
  readonly actorId: number;
  readonly actors: ReadonlyArray<FellowshipLogsGatewayReportActor>;
}) {
  return actors.find((actor) => {
    return actor.id === actorId;
  });
}

function getActorId({
  actorId,
  actors,
}: {
  readonly actorId: number;
  readonly actors: ReadonlyArray<FellowshipLogsGatewayReportActor>;
}): string {
  const actor = getActorById({
    actorId,
    actors,
  });

  return String(actor?.gameID ?? actorId);
}

function getActorName({
  actorId,
  actors,
}: {
  readonly actorId: number;
  readonly actors: ReadonlyArray<FellowshipLogsGatewayReportActor>;
}): string {
  const actor = getActorById({
    actorId,
    actors,
  });

  return actor?.name ?? "";
}

export function convertFellowshipLogsGatewayEvent({
  actors,
  dungeonStartEvent,
  event,
  reportStartTime,
}: ConvertFellowshipLogsEventOptions): FellowshipEvent | undefined {
  const timestamp = DateTime.makeUnsafe(reportStartTime + event.timestamp);

  return Match.value(event).pipe(
    Match.when(
      {
        type: "dungeonstart",
      },
      (fellowshipLogsDungeonStartEvent) => {
        const absoluteDungeonLevel = fellowshipLogsDungeonStartEvent.level;

        return {
          absoluteDungeonLevel,
          affixIds: fellowshipLogsDungeonStartEvent.affixes.map(String),
          dungeonId: String(fellowshipLogsDungeonStartEvent.encounterID),
          dungeonLevel:
            getDungeonLevelFromAbsoluteDungeonLevel(absoluteDungeonLevel),
          dungeonName: fellowshipLogsDungeonStartEvent.name,
          startedAt: timestamp,
          timestamp,
          type: FELLOWSHIP_EVENT.DUNGEON_START,
          unmappedFlag: false,
        } satisfies FellowshipEvent;
      },
    ),
    Match.when(
      {
        type: "dungeonend",
      },
      (dungeonEndEvent) => {
        if (dungeonStartEvent === undefined) {
          return undefined;
        }

        return {
          absoluteDungeonLevel: dungeonStartEvent.absoluteDungeonLevel,
          affixIds: dungeonStartEvent.affixIds,
          dungeonId: dungeonStartEvent.dungeonId,
          dungeonLevel: dungeonStartEvent.dungeonLevel,
          dungeonName: dungeonStartEvent.dungeonName,
          succeeded: dungeonEndEvent.kill,
          timestamp,
          type: FELLOWSHIP_EVENT.DUNGEON_END,
          unmapped: {
            flag1: false,
            flag2: false,
            flag3: false,
            numericField1: 0,
            numericField2: 0,
          },
        } satisfies FellowshipEvent;
      },
    ),
    Match.when(
      {
        type: "cast",
      },
      (castEvent) => {
        const hasTarget = castEvent.targetID >= 0;

        return {
          abilityId: String(castEvent.abilityGameID),
          abilityName: "",
          hasTarget,
          sourceId: getActorId({
            actorId: castEvent.sourceID,
            actors,
          }),
          sourceName: getActorName({
            actorId: castEvent.sourceID,
            actors,
          }),
          targetId: hasTarget
            ? getActorId({
                actorId: castEvent.targetID,
                actors,
              })
            : "",
          targetName: hasTarget
            ? getActorName({
                actorId: castEvent.targetID,
                actors,
              })
            : "",
          timestamp,
          type: FELLOWSHIP_EVENT.ABILITY_ACTIVATED,
          unmapped: {
            currentHealth: 0,
            maximumHealth: 0,
            positionX: 0,
            positionY: 0,
            positionZ: 0,
            resourceValue: 0,
            unmappedArrayData: "",
          },
        } satisfies FellowshipEvent;
      },
    ),
    Match.when(
      {
        type: "death",
      },
      (deathEvent) => {
        const unitTypeId = getActorId({
          actorId: deathEvent.targetID,
          actors,
        });

        return {
          abilityId: "",
          abilityName: "",
          dungeonProgress: 0,
          relatedAbilityId: "",
          sourcePlayerId: "",
          sourcePlayerName: "",
          timestamp,
          type: FELLOWSHIP_EVENT.UNIT_DEATH,
          unitId: unitTypeId,
          unitInstanceId:
            deathEvent.targetInstance === undefined
              ? ""
              : String(deathEvent.targetInstance),
          unitName: getActorName({
            actorId: deathEvent.targetID,
            actors,
          }),
          unitTypeId,
        } satisfies FellowshipEvent;
      },
    ),
    Match.exhaustive,
  );
}
