import { doesDungeonIdentityMatch } from "@frt/api/services/fellowship/utilities/does-dungeon-identity-match.ts";
import { type DungeonStartEvent } from "@frt/shared/fellowship/validation/events/dungeon-start.ts";
import { type DungeonId } from "@frt/shared/fellowship/validation/fellowship-common.ts";

type DungeonConfigurationIdentity = {
  readonly dungeonId: DungeonId;
  readonly dungeonLevel: number;
};

type DungeonRunIdentity = {
  readonly start: DungeonStartEvent;
};

export type DoesDungeonRunMatchConfigurationOptions = {
  readonly configuration: DungeonConfigurationIdentity;
  readonly run: DungeonRunIdentity;
};

export function doesDungeonRunMatchConfiguration({
  configuration,
  run,
}: DoesDungeonRunMatchConfigurationOptions): boolean {
  return doesDungeonIdentityMatch({
    left: run.start,
    right: configuration,
  });
}
