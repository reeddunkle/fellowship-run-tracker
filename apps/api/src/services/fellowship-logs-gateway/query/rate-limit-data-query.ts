import { makeQuery } from "./make-query.ts";

export const RATE_LIMIT_DATA_SELECTION = `
  rateLimitData {
    limitPerHour
    pointsSpentThisHour
    pointsResetIn
  }
`;

export const RATE_LIMIT_DATA_QUERY = makeQuery({
  selections: [RATE_LIMIT_DATA_SELECTION],
});
