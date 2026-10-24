import * as Console from "effect/Console";
import * as E from "effect/Effect";
import { HttpClient, HttpClientRequest } from "effect/http";
import * as Predicate from "effect/Predicate";
import type * as Redacted from "effect/Redacted";

import { DUNGEON_RUN_METADATA_SELECTION } from "@frt/api/services/fellowship-logs-gateway/query/get-dungeon-run-metadata-query.ts";
import { REPORT_SELECTION } from "@frt/api/services/fellowship-logs-gateway/query/report-query.ts";

const FELLOWSHIP_LOGS_USER_API_URL =
  "https://www.fellowshiplogs.com/api/v2/user";
const USER_ELIGIBLE_LABEL = "User-Eligible Points";
const POINT_LABEL_PATTERN = /\[([^\]]* Points)\]\s*$/;
const PROBE_REPORT_CODE = "XdfFZzgHBJNr6m3v";
const PROBE_FIGHT_ID = 15;
const MIXED_FIELD_CANDIDATES = ["rankings", "playerDetails", "table"];

const TYPE_REF_SELECTION =
  "name kind ofType { name kind ofType { name kind ofType { name kind } } }";

type SelectionTree = { readonly [field: string]: SelectionTree };

const LEAF: SelectionTree = {};

const IMPORT_SELECTION_TREE: SelectionTree = {
  rateLimitData: {
    currentRequest: LEAF,
    limitPerHour: LEAF,
    pointsResetIn: LEAF,
    pointsSpentThisHour: LEAF,
    userHasRemainingPoints: LEAF,
    userPointsResetIn: LEAF,
  },
  reportData: {
    report: {
      code: LEAF,
      endTime: LEAF,
      events: { data: LEAF, nextPageTimestamp: LEAF },
      fights: {
        difficultyLevel: LEAF,
        encounterID: LEAF,
        endTime: LEAF,
        id: LEAF,
        inProgress: LEAF,
        startTime: LEAF,
      },
      masterData: {
        actors: {
          gameID: LEAF,
          id: LEAF,
          name: LEAF,
          petOwner: LEAF,
          subType: LEAF,
          type: LEAF,
        },
        gameVersion: LEAF,
        logVersion: LEAF,
      },
      revision: LEAF,
      startTime: LEAF,
      title: LEAF,
    },
  },
};

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

const COST_SELECTION = `
  rateLimitData {
    currentRequest
    pointsSpentThisHour
    userHasRemainingPoints
    userPointsResetIn
  }
`;

type IntrospectedField = {
  readonly description: string | null;
  readonly name: string;
  readonly namedType: string | null;
};

function getPointLabel(description: string | null) {
  return description?.match(POINT_LABEL_PATTERN)?.[1] ?? null;
}

type GraphQLResult = {
  readonly body: unknown;
  readonly status: number;
};

function getProperty(value: unknown, ...path: ReadonlyArray<string>): unknown {
  return path.reduce<unknown>(
    (current, key) =>
      Predicate.isObject(current) ? (current[key] ?? null) : null,
    value,
  );
}

function getNamedType(typeRef: unknown): string | null {
  if (!Predicate.isObject(typeRef)) {
    return null;
  }

  return Predicate.isString(typeRef.name)
    ? typeRef.name
    : getNamedType(typeRef.ofType);
}

function getErrorMessages(body: unknown) {
  const errors = getProperty(body, "errors");

  return Array.isArray(errors)
    ? errors
        .map((error) => getProperty(error, "message"))
        .filter(Predicate.isString)
    : [];
}

function describeResult(result: GraphQLResult) {
  const data = getProperty(result.body, "data");

  return {
    currentRequest: getProperty(data, "rateLimitData", "currentRequest"),
    errors: getErrorMessages(result.body),
    hasReportData: getProperty(data, "reportData", "report") !== null,
    status: result.status,
    userHasRemainingPoints: getProperty(
      data,
      "rateLimitData",
      "userHasRemainingPoints",
    ),
  };
}

function makeProbeQuery({
  name,
  onlySpendUserPoints,
  selections,
  variables,
}: {
  readonly name: string;
  readonly onlySpendUserPoints: boolean;
  readonly selections: ReadonlyArray<string>;
  readonly variables: ReadonlyArray<string>;
}) {
  const variableDefinitions =
    variables.length === 0 ? "" : `(${variables.join(", ")})`;
  const directive = onlySpendUserPoints ? " @onlySpendUserPoints" : "";

  return `query ${name}${variableDefinitions}${directive} { ${selections.join("\n")} }`;
}

const postGraphQL = E.fnUntraced(function* (
  accessToken: Redacted.Redacted<string>,
  query: string,
  variables: Readonly<Record<string, unknown>> = {},
) {
  const httpClient = yield* HttpClient.HttpClient;
  const request = yield* HttpClientRequest.post(
    FELLOWSHIP_LOGS_USER_API_URL,
  ).pipe(
    HttpClientRequest.acceptJson,
    HttpClientRequest.bearerToken(accessToken),
    HttpClientRequest.bodyJson({ query, variables }),
  );
  const response = yield* httpClient.execute(request);
  const body = yield* response.json.pipe(E.orElseSucceed(() => null));

  return { body, status: response.status } satisfies GraphQLResult;
});

const introspectFields = E.fnUntraced(function* (
  accessToken: Redacted.Redacted<string>,
  typeName: string,
) {
  const result = yield* postGraphQL(
    accessToken,
    `query ProbeType($name: String!) { __type(name: $name) { fields { name description type { ${TYPE_REF_SELECTION} } } } }`,
    { name: typeName },
  );
  const fields = getProperty(result.body, "data", "__type", "fields");

  if (!Array.isArray(fields)) {
    return [];
  }

  return fields
    .filter(Predicate.isObject)
    .filter((field) => Predicate.isString(field.name))
    .map((field) => {
      return {
        description: Predicate.isString(field.description)
          ? field.description
          : null,
        name: String(field.name),
        namedType: getNamedType(field.type),
      } satisfies IntrospectedField;
    });
});

const checkFieldLabels = E.fnUntraced(function* (
  accessToken: Redacted.Redacted<string>,
) {
  const schema = yield* postGraphQL(
    accessToken,
    "query ProbeRoot { __schema { queryType { name } } }",
  );
  const rootType = getProperty(
    schema.body,
    "data",
    "__schema",
    "queryType",
    "name",
  );
  const fieldsByType = new Map<string, ReadonlyArray<IntrospectedField>>();
  const typeByPath = new Map<string, string>();
  const labels: Array<{
    readonly description: string | null;
    readonly path: string;
    readonly pointLabel: string | null;
  }> = [];

  const getFields = E.fnUntraced(function* (typeName: string) {
    const cached = fieldsByType.get(typeName);

    if (cached !== undefined) {
      return cached;
    }

    const fields = yield* introspectFields(accessToken, typeName);
    fieldsByType.set(typeName, fields);

    return fields;
  });

  const walk: (
    tree: SelectionTree,
    typeName: string,
    path: string,
  ) => E.Effect<void, unknown, HttpClient.HttpClient> = E.fnUntraced(
    function* (tree, typeName, path) {
      const fields = yield* getFields(typeName);

      for (const [name, subtree] of Object.entries(tree)) {
        const field = fields.find((candidate) => candidate.name === name);
        const fieldPath = path === "" ? name : `${path}.${name}`;

        labels.push({
          description: field?.description ?? null,
          path: `${typeName}.${name} (${fieldPath})`,
          pointLabel: getPointLabel(field?.description ?? null),
        });

        if (
          field?.namedType !== null &&
          field?.namedType !== undefined &&
          Object.keys(subtree).length > 0
        ) {
          typeByPath.set(fieldPath, field.namedType);
          yield* walk(subtree, field.namedType, fieldPath);
        }
      }
    },
  );

  if (!Predicate.isString(rootType)) {
    return {
      error: "The schema did not report a query type.",
      labels,
      mixedField: null,
    };
  }

  yield* walk(IMPORT_SELECTION_TREE, rootType, "");

  const reportTypeName = typeByPath.get("reportData.report");
  const reportFields =
    reportTypeName === undefined
      ? []
      : (fieldsByType.get(reportTypeName) ?? []);
  const mixedField =
    MIXED_FIELD_CANDIDATES.map((name) =>
      reportFields.find(
        (field) =>
          field.name === name &&
          getPointLabel(field.description) !== USER_ELIGIBLE_LABEL,
      ),
    ).find(Predicate.isNotUndefined) ?? null;

  return {
    error: null,
    labels,
    mixedField:
      mixedField === null
        ? null
        : {
            name: mixedField.name,
            pointLabel: getPointLabel(mixedField.description),
          },
  };
});

const readDirective = E.fnUntraced(function* (
  accessToken: Redacted.Redacted<string>,
) {
  const result = yield* postGraphQL(
    accessToken,
    "query ProbeDirectives { __schema { directives { name description locations args { name description } } } }",
  );
  const directives = getProperty(result.body, "data", "__schema", "directives");

  return Array.isArray(directives)
    ? (directives.find(
        (directive) => getProperty(directive, "name") === "onlySpendUserPoints",
      ) ?? null)
    : null;
});

export const checkPointPolicy = E.fnUntraced(function* (
  accessToken: Redacted.Redacted<string>,
) {
  yield* Console.log("Reading point labels and the directive definition.");

  const fieldLabels = yield* checkFieldLabels(accessToken);
  const directive = yield* readDirective(accessToken);
  const fightVariables = {
    fightId: PROBE_FIGHT_ID,
    reportCode: PROBE_REPORT_CODE,
  };
  const fightVariableDefinitions = ["$reportCode: String!", "$fightId: Int!"];

  const run = (
    name: string,
    onlySpendUserPoints: boolean,
    selections: ReadonlyArray<string>,
    variables: ReadonlyArray<string> = [],
    values: Readonly<Record<string, unknown>> = {},
  ) =>
    Console.log(`Running ${name}.`).pipe(
      E.andThen(
        postGraphQL(
          accessToken,
          makeProbeQuery({ name, onlySpendUserPoints, selections, variables }),
          values,
        ),
      ),
      E.map(describeResult),
    );

  const runBoth = E.fnUntraced(function* (
    name: string,
    selections: ReadonlyArray<string>,
    variables: ReadonlyArray<string>,
    values: Readonly<Record<string, unknown>>,
  ) {
    return {
      default: yield* run(
        `${name}Default`,
        false,
        selections,
        variables,
        values,
      ),
      strict: yield* run(`${name}Strict`, true, selections, variables, values),
    };
  });

  const costOnly = yield* runBoth("ProbeCost", [COST_SELECTION], [], {});
  const fight = yield* runBoth(
    "ProbeFight",
    [FIGHT_SELECTION, COST_SELECTION],
    fightVariableDefinitions,
    fightVariables,
  );
  const metadata = yield* runBoth(
    "ProbeMetadata",
    [DUNGEON_RUN_METADATA_SELECTION, COST_SELECTION],
    fightVariableDefinitions,
    fightVariables,
  );

  const fights = getProperty(
    (yield* postGraphQL(
      accessToken,
      makeProbeQuery({
        name: "ProbeFightWindow",
        onlySpendUserPoints: false,
        selections: [FIGHT_SELECTION],
        variables: fightVariableDefinitions,
      }),
      fightVariables,
    )).body,
    "data",
    "reportData",
    "report",
    "fights",
  );
  const [probeFight] = Array.isArray(fights) ? fights : [];
  const startTime = getProperty(probeFight, "startTime");
  const endTime = getProperty(probeFight, "endTime");
  const reportEvents =
    Predicate.isNumber(startTime) && Predicate.isNumber(endTime)
      ? yield* runBoth(
          "ProbeReportEvents",
          [REPORT_SELECTION, COST_SELECTION],
          ["$reportCode: String!", "$startTime: Float!", "$endTime: Float!"],
          { endTime, reportCode: PROBE_REPORT_CODE, startTime },
        )
      : { skipped: "The probe fight window could not be read." };

  const mixed =
    fieldLabels.mixedField === null
      ? {
          skipped: "No report field without the user-eligible label was found.",
        }
      : yield* runBoth(
          "ProbeMixed",
          [
            `reportData { report(code: $reportCode) { fights(fightIDs: [$fightId]) { id } ${fieldLabels.mixedField.name} } }`,
            COST_SELECTION,
          ],
          fightVariableDefinitions,
          fightVariables,
        );

  return {
    directive,
    fieldLabels,
    probeReport: { fightId: PROBE_FIGHT_ID, reportCode: PROBE_REPORT_CODE },
    queries: { costOnly, fight, metadata, mixed, reportEvents },
  };
});
