import { type FellowshipMilestoneConfiguration } from "@frt/shared/fellowship/configurations/configuration-types.ts";

export const DUNGEON_START_LINE =
  '2026-08-19T22:35:02.873-04:00|DUNGEON_START|"Everdawn Grove"|11|84|[4,6,14,19]|0|2026-08-19T22:35:03.581-04:00|';

export const DUNGEON_START_CONFIGURATION = {
  dungeonId: "11",
  dungeonLevel: 64,
  milestones: [],
} satisfies FellowshipMilestoneConfiguration;
