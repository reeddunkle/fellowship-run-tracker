export const REPORT_SELECTION = `
  reportData {
    report(code: $reportCode) {
      code
      title
      startTime
      endTime
      revision

      masterData {
        logVersion
        gameVersion
        actors {
          id
          gameID
          name
          type
          subType
          petOwner
        }
      }

      events(
        startTime: $startTime
        endTime: $endTime
        limit: 10000
        translate: false
        useAbilityIDs: true
        useActorIDs: true
      ) {
        data
        nextPageTimestamp
      }
    }
  }
`;

export const REPORT_VARIABLES = [
  "$reportCode: String!",
  "$startTime: Float!",
  "$endTime: Float!",
];
