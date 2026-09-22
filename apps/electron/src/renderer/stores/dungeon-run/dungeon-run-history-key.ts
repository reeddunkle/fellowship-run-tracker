import { type FellowshipMilestoneConfiguration } from "@frt/shared/fellowship/configurations/configuration-types.ts";

export type DungeonRunHistoryKey = Pick<
  FellowshipMilestoneConfiguration,
  "dungeonId" | "dungeonLevel"
>;
