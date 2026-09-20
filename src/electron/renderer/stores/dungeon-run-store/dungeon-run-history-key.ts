import { type FellowshipMilestoneConfiguration } from "@/services/fellowship/configurations/configuration-types.ts";

export type DungeonRunHistoryKey = Pick<
  FellowshipMilestoneConfiguration,
  "dungeonId" | "dungeonLevel"
>;
