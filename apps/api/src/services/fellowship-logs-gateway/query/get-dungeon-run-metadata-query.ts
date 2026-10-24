import { makeQuery } from "./make-query.ts";
import { RATE_LIMIT_DATA_SELECTION } from "./rate-limit-data-query.ts";

export const DUNGEON_RUN_METADATA_SELECTION = `
  reportData {
    report(code: $reportCode) {
      startTime
      endTime
      fights(fightIDs: [$fightId]) {
        id
        encounterID
        difficultyLevel
        startTime
        endTime
        inProgress
      }
    }
  }
`;

export const DUNGEON_RUN_METADATA_VARIABLES = [
  "$reportCode: String!",
  "$fightId: Int!",
];

export const DUNGEON_RUN_METADATA_QUERY = makeQuery({
  capability: "USER_POINT_ELIGIBLE",
  name: "GetDungeonRunMetadata",
  selections: [DUNGEON_RUN_METADATA_SELECTION, RATE_LIMIT_DATA_SELECTION],
  variables: DUNGEON_RUN_METADATA_VARIABLES,
});
