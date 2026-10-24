import { makeQuery } from "./make-query.ts";

export const RATE_LIMIT_DATA_SELECTION = `
  rateLimitData {
    currentRequest
    limitPerHour
    pointsSpentThisHour
    pointsResetIn
    databaseLimitPerHour
    databasePointsSpentThisHour
    userHasRemainingPoints
    userPointsResetIn
  }
`;

export const RATE_LIMIT_DATA_QUERY = makeQuery({
  capability: "USER_POINT_ELIGIBLE",
  selections: [RATE_LIMIT_DATA_SELECTION],
});
