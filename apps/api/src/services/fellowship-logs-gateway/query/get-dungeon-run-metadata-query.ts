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
