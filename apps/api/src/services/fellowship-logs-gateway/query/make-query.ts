import * as Option from "effect/Option";

import { type FellowshipLogsGatewaySpending } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-point-policy.ts";

const ONLY_SPEND_USER_POINTS_DIRECTIVE = "@onlySpendUserPoints";

const OPERATION_HEADER_PATTERN =
  /^(\s*query(?:\s+\w+)?(?:\s*\([^)]*\))?)(\s*\{)/;

export type FellowshipLogsGatewayQueryCapability =
  | "UNCLASSIFIED"
  | "USER_POINT_ELIGIBLE";

export type FellowshipLogsGatewayQuery = {
  readonly capability: FellowshipLogsGatewayQueryCapability;
  readonly document: string;
};

export function makeQuery({
  capability,
  name,
  selections,
  variables,
}: {
  readonly capability: FellowshipLogsGatewayQueryCapability;
  readonly name?: string;
  readonly selections: ReadonlyArray<string>;
  readonly variables?: ReadonlyArray<string>;
}): FellowshipLogsGatewayQuery {
  const operationName = name === undefined ? "" : ` ${name}`;
  const variableDefinitions =
    variables === undefined || variables.length === 0
      ? ""
      : `(
        ${variables.join("\n")}
      )`;

  return {
    capability,
    document: `
      query${operationName}${variableDefinitions} {
        ${selections.join("\n")}
      }
    `,
  };
}

export function applyQuerySpending(
  query: FellowshipLogsGatewayQuery,
  spending: FellowshipLogsGatewaySpending,
): Option.Option<string> {
  if (spending === "DEFAULT") {
    return Option.some(query.document);
  }

  if (query.document.includes("@")) {
    return Option.none();
  }

  const header = OPERATION_HEADER_PATTERN.exec(query.document);

  if (header === null) {
    return Option.none();
  }

  const [match, operation, selectionStart] = header;

  return Option.some(
    `${operation} ${ONLY_SPEND_USER_POINTS_DIRECTIVE}${selectionStart}${query.document.slice(match.length)}`,
  );
}
