import { makeQuery } from "./make-query.ts";

const FIGHT_SELECTION = `
  reportData {
    report(code: $reportCode) {
      fights(fightIDs: [$fightId]) {
        id
        startTime
        endTime
      }
    }
  }
`;

export const GET_FIGHT_QUERY = makeQuery({
  name: "GetFight",
  selections: [FIGHT_SELECTION],
  variables: ["$reportCode: String!", "$fightId: Int!"],
});
