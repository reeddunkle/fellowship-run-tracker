import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";

import { appConfig } from "@frt/api/app-config.ts";
import { FellowshipLogsGatewayRequestError } from "@frt/api/errors/fellowship-logs-gateway-error.ts";
import { NodeHttpClientLayer } from "@frt/api/layers/node-platform-layer.ts";
import {
  type FellowshipLogsGatewayCredentials,
  makeClientCredentialsGatewayAccessSource,
} from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-access.ts";
import { makeFellowshipLogsGatewayHttpQuery } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-http-query.ts";
import { FellowshipLogsGatewayRequestPacer } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-request-pacer.ts";
import {
  findFightOrFail,
  getGraphQLResponseData,
  getReportOrFail,
} from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-response-helpers.ts";
import {
  DUNGEON_RUN_METADATA_SELECTION,
  DUNGEON_RUN_METADATA_VARIABLES,
} from "@frt/api/services/fellowship-logs-gateway/query/get-dungeon-run-metadata-query.ts";
import { makeQuery } from "@frt/api/services/fellowship-logs-gateway/query/make-query.ts";
import {
  RATE_LIMIT_DATA_QUERY,
  RATE_LIMIT_DATA_SELECTION,
} from "@frt/api/services/fellowship-logs-gateway/query/rate-limit-data-query.ts";
import { FellowshipLogsGatewayDungeonRunMetadataResponseDataSchema } from "@frt/api/services/fellowship-logs-gateway/validation/fellowship-logs-gateway-dungeon-run-metadata-schema.ts";
import { FellowshipLogsGatewayReportEventsSchema } from "@frt/api/services/fellowship-logs-gateway/validation/fellowship-logs-gateway-report-schema.ts";
import { FellowshipLogsFightIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import {
  FellowshipLogsRateLimitResponseDataSchema,
  withRateLimitData,
} from "@frt/shared/fellowship-logs/fellowship-logs-rate-limit-schema.ts";
import { FellowshipLogsReportCodeSchema } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";
import { NonEmptyStringSchema } from "@frt/shared/util/common-schemas.ts";

const EVENT_LIMIT = 10_000;
const MAX_ADDITIONAL_POINTS = 200;

const RAW_EVENT_SELECTION = `
  reportData {
    report(code: $reportCode) {
      events(
        startTime: $startTime
        endTime: $endTime
        limit: ${EVENT_LIMIT}
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

const RAW_EVENT_VARIABLES = [
  "$reportCode: String!",
  "$startTime: Float!",
  "$endTime: Float!",
];

const RawEventResponseDataSchema = withRateLimitData({
  reportData: Schema.Struct({
    report: Schema.Struct({
      events: FellowshipLogsGatewayReportEventsSchema,
    }).pipe(Schema.NullOr),
  }),
});

type ProbeOptions = {
  readonly credentials: FellowshipLogsGatewayCredentials;
  readonly fightId: typeof FellowshipLogsFightIdSchema.Type;
  readonly outputDirectory: string;
  readonly reportCode: typeof FellowshipLogsReportCodeSchema.Type;
};

type ProbeState = {
  readonly baselinePoints: number;
  readonly eventCount: number;
  readonly fieldsByType: Readonly<Record<string, ReadonlyArray<string>>>;
  readonly ledger: ReadonlyArray<{
    readonly cumulativePoints: number;
    readonly eventCount: number;
    readonly nextPageTimestamp: number | null;
    readonly pageNumber: number;
    readonly requestCost: number;
  }>;
  readonly previousPoints: number;
  readonly typeCounts: Readonly<Record<string, number>>;
};

function stringifyJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function getEventType(event: unknown) {
  if (
    typeof event === "object" &&
    event !== null &&
    Object.hasOwn(event, "type")
  ) {
    const eventRecord = event as Readonly<Record<string, unknown>>;

    if (typeof eventRecord.type === "string") {
      return eventRecord.type;
    }
  }

  return "<missing>";
}

function getEventFields(event: unknown) {
  if (typeof event !== "object" || event === null) {
    return [];
  }

  return Object.keys(event).toSorted();
}

function failProbe(message: string) {
  return new FellowshipLogsGatewayRequestError({
    cause: new Error(message),
    operation: "Query",
  });
}

function addEventsToInventory(
  state: ProbeState,
  events: ReadonlyArray<unknown>,
) {
  const fieldsByType = new Map(
    Object.entries(state.fieldsByType).map(([type, fields]) => {
      return [type, new Set(fields)];
    }),
  );
  const typeCounts = new Map(Object.entries(state.typeCounts));

  for (const event of events) {
    const type = getEventType(event);
    const fields = fieldsByType.get(type) ?? new Set<string>();

    for (const field of getEventFields(event)) {
      fields.add(field);
    }

    fieldsByType.set(type, fields);
    typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
  }

  return {
    ...state,
    eventCount: state.eventCount + events.length,
    fieldsByType: Object.fromEntries(
      Array.from(fieldsByType, ([type, fields]) => {
        return [type, Array.from(fields).toSorted()];
      }),
    ),
    typeCounts: Object.fromEntries(typeCounts),
  };
}

const probeFellowshipLogsEncounters = E.fn("probeFellowshipLogsEncounters")(
  function* ({
    credentials,
    fightId,
    outputDirectory,
    reportCode,
  }: ProbeOptions) {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const query = yield* makeFellowshipLogsGatewayHttpQuery(
      makeClientCredentialsGatewayAccessSource(credentials),
    );
    const resolvedOutputDirectory = path.resolve(outputDirectory);

    yield* fileSystem.makeDirectory(resolvedOutputDirectory, {
      recursive: true,
    });

    const metadataResponse = yield* query(
      {
        query: makeQuery({
          capability: "UNCLASSIFIED",
          name: "GetRawEventCensusBounds",
          selections: [DUNGEON_RUN_METADATA_SELECTION],
          variables: DUNGEON_RUN_METADATA_VARIABLES,
        }),
        variables: { fightId, reportCode },
      },
      FellowshipLogsGatewayDungeonRunMetadataResponseDataSchema,
    );
    const metadataData = yield* getGraphQLResponseData(metadataResponse);
    const metadataReport = yield* getReportOrFail({
      report: metadataData.reportData.report,
      reportCode,
    });
    const fight = yield* findFightOrFail({
      fightId,
      fights: metadataReport.fights,
      reportCode,
    });

    yield* fileSystem.writeFileString(
      path.join(resolvedOutputDirectory, "metadata.json"),
      stringifyJson(metadataResponse),
    );

    const baselineResponse = yield* query(
      { query: RATE_LIMIT_DATA_QUERY },
      FellowshipLogsRateLimitResponseDataSchema,
    );
    const baselineData = yield* getGraphQLResponseData(baselineResponse);
    const baselinePoints = baselineData.rateLimitData.pointsSpentThisHour;
    const initialState: ProbeState = {
      baselinePoints,
      eventCount: 0,
      fieldsByType: {},
      ledger: [],
      previousPoints: baselinePoints,
      typeCounts: {},
    };

    yield* fileSystem.writeFileString(
      path.join(resolvedOutputDirectory, "baseline.json"),
      stringifyJson(baselineResponse),
    );

    const runPage = E.fnUntraced(function* (
      startTime: number,
      pageNumber: number,
      state: ProbeState,
    ): E.fn.Return<ProbeState, unknown, never> {
      const response = yield* query(
        {
          query: makeQuery({
            capability: "UNCLASSIFIED",
            name: "CensusRawEventTypes",
            selections: [RAW_EVENT_SELECTION, RATE_LIMIT_DATA_SELECTION],
            variables: RAW_EVENT_VARIABLES,
          }),
          variables: {
            endTime: fight.endTime,
            reportCode,
            startTime,
          },
        },
        RawEventResponseDataSchema,
      );
      const responseData = yield* getGraphQLResponseData(response);
      const report = yield* getReportOrFail({
        report: responseData.reportData.report,
        reportCode,
      });
      const rateLimitData = responseData.rateLimitData;

      if (rateLimitData === undefined) {
        return yield* failProbe(
          "The raw event response did not include rate-limit data.",
        );
      }

      const cumulativePoints = rateLimitData.pointsSpentThisHour;
      const requestCost = cumulativePoints - state.previousPoints;
      const additionalPoints = cumulativePoints - state.baselinePoints;

      if (requestCost < 0) {
        return yield* failProbe(
          "The Fellowship Logs point counter reset during the raw event census.",
        );
      }

      if (additionalPoints > MAX_ADDITIONAL_POINTS) {
        return yield* failProbe(
          `The raw event census exceeded its ${MAX_ADDITIONAL_POINTS}-point ceiling.`,
        );
      }

      yield* fileSystem.writeFileString(
        path.join(resolvedOutputDirectory, `page-${pageNumber}.json`),
        stringifyJson(response),
      );

      const inventoriedState = addEventsToInventory(state, report.events.data);
      const nextState: ProbeState = {
        ...inventoriedState,
        ledger: [
          ...inventoriedState.ledger,
          {
            cumulativePoints,
            eventCount: report.events.data.length,
            nextPageTimestamp: report.events.nextPageTimestamp,
            pageNumber,
            requestCost,
          },
        ],
        previousPoints: cumulativePoints,
      };
      const nextPageTimestamp = report.events.nextPageTimestamp;

      if (nextPageTimestamp === null) {
        return nextState;
      }

      if (nextPageTimestamp <= startTime) {
        return yield* failProbe(
          `Raw events returned a non-advancing cursor: ${nextPageTimestamp}.`,
        );
      }

      return yield* runPage(nextPageTimestamp, pageNumber + 1, nextState);
    });

    const finalState = yield* runPage(fight.startTime, 1, initialState);
    const summary = {
      additionalPoints: finalState.previousPoints - finalState.baselinePoints,
      eventCount: finalState.eventCount,
      fieldsByType: finalState.fieldsByType,
      fight,
      ledger: finalState.ledger,
      maxAdditionalPoints: MAX_ADDITIONAL_POINTS,
      reportCode,
      typeCounts: finalState.typeCounts,
    };

    yield* fileSystem.writeFileString(
      path.join(resolvedOutputDirectory, "summary.json"),
      stringifyJson(summary),
    );

    yield* E.logInfo("Captured Fellowship Logs raw event census.", {
      additionalPoints: summary.additionalPoints,
      eventCount: summary.eventCount,
      outputDirectory: resolvedOutputDirectory,
      pageCount: summary.ledger.length,
      types: Object.keys(summary.typeCounts).toSorted(),
    });
  },
);

const runProbeFellowshipLogsEncountersCommand = E.fn(
  "runProbeFellowshipLogsEncountersCommand",
)(function* (input: {
  readonly fightId: typeof FellowshipLogsFightIdSchema.Type;
  readonly outputDirectory: string;
  readonly reportCode: typeof FellowshipLogsReportCodeSchema.Type;
}) {
  const clientIdOption = yield* appConfig.fellowshipLogsClientId;
  const clientSecretOption = yield* appConfig.fellowshipLogsClientSecret;

  if (Option.isNone(clientIdOption) || Option.isNone(clientSecretOption)) {
    return yield* new FellowshipLogsGatewayRequestError({
      cause: new Error(
        "Fellowship Logs credentials are not configured in the environment.",
      ),
      operation: "GetAccessToken",
    });
  }

  return yield* probeFellowshipLogsEncounters({
    ...input,
    credentials: {
      clientId: clientIdOption.value,
      clientSecret: clientSecretOption.value,
    },
  });
});

export const probeFellowshipLogsEncountersCommand = Command.make(
  "probe-fellowship-logs-encounters",
  {
    fightId: Flag.Int("fight-id").pipe(
      Flag.withSchema(FellowshipLogsFightIdSchema),
      Flag.withDescription("Fight ID within the report."),
    ),
    outputDirectory: Flag.String("output").pipe(
      Flag.withAlias("o"),
      Flag.withSchema(NonEmptyStringSchema),
      Flag.withDefault("data/fellowship-logs-encounter-probe/raw-event-census"),
      Flag.withDescription(
        "Directory for raw event pages and the census summary.",
      ),
    ),
    reportCode: Flag.String("report-code").pipe(
      Flag.withSchema(FellowshipLogsReportCodeSchema),
      Flag.withDescription("Fellowship Logs report code."),
    ),
  },
  runProbeFellowshipLogsEncountersCommand,
).pipe(
  Command.withDescription(
    "Capture every normalized event type in a Fellowship Logs dungeon run.",
  ),
  Command.provide(
    Layer.mergeAll(
      NodeHttpClientLayer,
      FellowshipLogsGatewayRequestPacer.layer,
    ),
  ),
);
