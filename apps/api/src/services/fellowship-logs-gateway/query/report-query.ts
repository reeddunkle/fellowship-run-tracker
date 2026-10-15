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

      dungeonStarts: events(
        startTime: $startTime
        endTime: $endTime
        filterExpression: "type = \\"dungeonstart\\""
        limit: 10000
        translate: false
        useAbilityIDs: true
        useActorIDs: true
      ) {
        data
        nextPageTimestamp
      }

      dungeonEnds: events(
        startTime: $startTime
        endTime: $endTime
        filterExpression: "type = \\"dungeonend\\""
        limit: 10000
        translate: false
        useAbilityIDs: true
        useActorIDs: true
      ) {
        data
        nextPageTimestamp
      }

      encounterStarts: events(
        startTime: $startTime
        endTime: $endTime
        filterExpression: "type = \\"dungeonencounterstart\\""
        limit: 10000
        translate: false
        useAbilityIDs: true
        useActorIDs: true
      ) {
        data
        nextPageTimestamp
      }

      encounterEnds: events(
        startTime: $startTime
        endTime: $endTime
        filterExpression: "type = \\"dungeonencounterend\\""
        limit: 10000
        translate: false
        useAbilityIDs: true
        useActorIDs: true
      ) {
        data
        nextPageTimestamp
      }

      casts: events(
        startTime: $startTime
        endTime: $endTime
        filterExpression: "type = \\"cast\\""
        limit: 10000
        translate: false
        useAbilityIDs: true
        useActorIDs: true
      ) {
        data
        nextPageTimestamp
      }

      deaths: events(
        startTime: $startTime
        endTime: $endTime
        filterExpression: "type = \\"death\\""
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
