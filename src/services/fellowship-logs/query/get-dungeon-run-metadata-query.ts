export const DUNGEON_RUN_METADATA_SELECTION = `
  reportData {
    report(code: $reportCode) {
      startTime
      fights(fightIDs: [$fightId]) {
        id
        encounterID
        difficultyLevel
        startTime
        endTime
      }
    }
  }
`;

export const DUNGEON_RUN_METADATA_VARIABLES = [
  "$reportCode: String!",
  "$fightId: Int!",
];
