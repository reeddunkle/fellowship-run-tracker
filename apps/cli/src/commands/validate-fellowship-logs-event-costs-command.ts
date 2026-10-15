import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";

import { appConfig } from "@frt/api/app-config.ts";
import { FellowshipLogsGatewayRequestError } from "@frt/api/errors/fellowship-logs-gateway-error.ts";
import { NodeHttpClientLayer } from "@frt/api/layers/node-platform-layer.ts";
import { makeFellowshipLogsGatewayHttpQuery } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-http-query.ts";
import {
  findFightOrFail,
  getGraphQLResponseData,
  getReportOrFail,
} from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-response-helpers.ts";
import { type FellowshipLogsGatewayCredentials } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-service.ts";
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
import { FellowshipLogsFightIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import {
  FellowshipLogsRateLimitResponseDataSchema,
  withRateLimitData,
} from "@frt/shared/fellowship-logs/fellowship-logs-rate-limit-schema.ts";
import { FellowshipLogsReportCodeSchema } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";
import { NonEmptyStringSchema } from "@frt/shared/util/common-schemas.ts";

const MAX_ADDITIONAL_POINTS = 100;
const LARGE_SOURCE_ID = 39;
const TINY_SOURCE_ID = 13;
const EVENT_LIMIT = 10_000;

const ValidationPhaseSchema = Schema.Literals(["before", "after"]);

const EventsPageSchema = Schema.Struct({
  data: Schema.Array(Schema.Unknown),
  nextPageTimestamp: Schema.Finite.pipe(Schema.NullOr),
});

const SingleEventsResponseDataSchema = withRateLimitData({
  reportData: Schema.Struct({
    report: Schema.Struct({
      events: EventsPageSchema,
    }).pipe(Schema.NullOr),
  }),
});

const CombinedEventsResponseDataSchema = withRateLimitData({
  reportData: Schema.Struct({
    report: Schema.Struct({
      large: EventsPageSchema,
      tiny: EventsPageSchema,
    }).pipe(Schema.NullOr),
  }),
});

type ValidationPhase = typeof ValidationPhaseSchema.Type;

type CostLedgerEntry = {
  readonly arm: string;
  readonly cumulativePoints: number;
  readonly eventCounts: Readonly<Record<string, number>>;
  readonly nextPageTimestamps: Readonly<Record<string, number | null>>;
  readonly pageNumber: number;
  readonly requestCost: number;
};

type CostState = {
  readonly baselinePoints: number;
  readonly eventsByArm: Readonly<Record<string, ReadonlyArray<unknown>>>;
  readonly ledger: ReadonlyArray<CostLedgerEntry>;
  readonly previousPoints: number;
};

type EventPage = typeof EventsPageSchema.Type;

type ValidationOptions = {
  readonly credentials: FellowshipLogsGatewayCredentials;
  readonly fightId: typeof FellowshipLogsFightIdSchema.Type;
  readonly outputDirectory: string;
  readonly phase: ValidationPhase;
  readonly reportCode: typeof FellowshipLogsReportCodeSchema.Type;
};

function stringifyJson(value: unknown) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function makeSingleEventsSelection(sourceId: number) {
  return `
    reportData {
      report(code: $reportCode) {
        events(
          startTime: $startTime
          endTime: $endTime
          filterExpression: "source.id = ${sourceId}"
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
}

const COMBINED_EVENTS_SELECTION = `
  reportData {
    report(code: $reportCode) {
      large: events(
        startTime: $startTime
        endTime: $endTime
        filterExpression: "source.id = ${LARGE_SOURCE_ID}"
        limit: ${EVENT_LIMIT}
        translate: false
        useAbilityIDs: true
        useActorIDs: true
      ) {
        data
        nextPageTimestamp
      }
      tiny: events(
        startTime: $startTime
        endTime: $endTime
        filterExpression: "source.id = ${TINY_SOURCE_ID}"
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

const EVENT_VARIABLES = [
  "$reportCode: String!",
  "$startTime: Float!",
  "$endTime: Float!",
];

function failValidation(message: string) {
  return new FellowshipLogsGatewayRequestError({
    cause: new Error(message),
    operation: "Query",
  });
}

function getRequestCost(state: CostState, cumulativePoints: number) {
  const requestCost = cumulativePoints - state.previousPoints;

  if (requestCost < 0) {
    return E.fail(
      failValidation(
        "The Fellowship Logs point counter reset during validation.",
      ),
    );
  }

  const additionalPoints = cumulativePoints - state.baselinePoints;

  if (additionalPoints > MAX_ADDITIONAL_POINTS) {
    return E.fail(
      failValidation(
        `Validation exceeded its ${MAX_ADDITIONAL_POINTS}-point ceiling.`,
      ),
    );
  }

  return E.succeed(requestCost);
}

const validateFellowshipLogsEventCosts = E.fn(
  "validateFellowshipLogsEventCosts",
)(function* ({
  credentials,
  fightId,
  outputDirectory,
  phase,
  reportCode,
}: ValidationOptions) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const query = yield* makeFellowshipLogsGatewayHttpQuery(() => {
    return E.succeed(credentials);
  });

  const resolvedOutputDirectory = path.resolve(outputDirectory, phase);

  if (yield* fileSystem.exists(resolvedOutputDirectory)) {
    yield* fileSystem.remove(resolvedOutputDirectory, { recursive: true });
  }

  yield* fileSystem.makeDirectory(resolvedOutputDirectory, { recursive: true });

  const metadataResponse = yield* query(
    {
      query: makeQuery({
        name: "GetValidationFightBounds",
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

  const baselineResponse = yield* query(
    { query: RATE_LIMIT_DATA_QUERY },
    FellowshipLogsRateLimitResponseDataSchema,
  );
  const baselineData = yield* getGraphQLResponseData(baselineResponse);
  const initialState: CostState = {
    baselinePoints: baselineData.rateLimitData.pointsSpentThisHour,
    eventsByArm: {},
    ledger: [],
    previousPoints: baselineData.rateLimitData.pointsSpentThisHour,
  };

  yield* fileSystem.writeFileString(
    path.join(resolvedOutputDirectory, "baseline.json"),
    stringifyJson(baselineResponse),
  );

  const recordResponse = E.fnUntraced(function* ({
    arm,
    eventPages,
    pageNumber,
    response,
    state,
  }: {
    readonly arm: string;
    readonly eventPages: Readonly<Record<string, EventPage>>;
    readonly pageNumber: number;
    readonly response: unknown;
    readonly state: CostState;
  }) {
    const rateLimitData = Object.hasOwn(response as object, "data")
      ? (
          response as {
            readonly data?: {
              readonly rateLimitData?: {
                readonly pointsSpentThisHour: number;
              };
            } | null;
          }
        ).data?.rateLimitData
      : undefined;

    if (rateLimitData === undefined) {
      return yield* failValidation(
        `The ${arm} response did not include rate-limit data.`,
      );
    }

    const cumulativePoints = rateLimitData.pointsSpentThisHour;
    const requestCost = yield* getRequestCost(state, cumulativePoints);
    const entry: CostLedgerEntry = {
      arm,
      cumulativePoints,
      eventCounts: Object.fromEntries(
        Object.entries(eventPages).map(([name, page]) => {
          return [name, page.data.length];
        }),
      ),
      nextPageTimestamps: Object.fromEntries(
        Object.entries(eventPages).map(([name, page]) => {
          return [name, page.nextPageTimestamp];
        }),
      ),
      pageNumber,
      requestCost,
    };

    yield* fileSystem.writeFileString(
      path.join(resolvedOutputDirectory, `${arm}-page-${pageNumber}.json`),
      stringifyJson(response),
    );

    const appendedEventsByArm = Object.fromEntries(
      Object.entries(eventPages).map(([name, page]) => {
        const eventArm = arm === "combined" ? `${arm}-${name}` : arm;

        return [
          eventArm,
          [...(state.eventsByArm[eventArm] ?? []), ...page.data],
        ];
      }),
    );
    const nextEventsByArm = {
      ...state.eventsByArm,
      ...appendedEventsByArm,
    };

    return {
      baselinePoints: state.baselinePoints,
      eventsByArm: nextEventsByArm,
      ledger: [...state.ledger, entry],
      previousPoints: cumulativePoints,
    } satisfies CostState;
  });

  const runSingleArm = E.fnUntraced(function* (
    arm: string,
    sourceId: number,
    state: CostState,
  ) {
    const runPage = E.fnUntraced(function* (
      startTime: number,
      pageNumber: number,
      currentState: CostState,
    ): E.fn.Return<CostState, unknown, never> {
      const response = yield* query(
        {
          query: makeQuery({
            name: "ValidateSingleEventsCost",
            selections: [
              makeSingleEventsSelection(sourceId),
              RATE_LIMIT_DATA_SELECTION,
            ],
            variables: EVENT_VARIABLES,
          }),
          variables: {
            endTime: fight.endTime,
            reportCode,
            startTime,
          },
        },
        SingleEventsResponseDataSchema,
      );
      const responseData = yield* getGraphQLResponseData(response);
      const report = responseData.reportData.report;

      if (report === null) {
        return yield* failValidation(
          `Fellowship Logs report "${reportCode}" was not found.`,
        );
      }

      const nextState = yield* recordResponse({
        arm,
        eventPages: { events: report.events },
        pageNumber,
        response,
        state: currentState,
      });
      const nextPageTimestamp = report.events.nextPageTimestamp;

      if (nextPageTimestamp === null) {
        return nextState;
      }

      if (nextPageTimestamp <= startTime) {
        return yield* failValidation(
          `${arm} returned a non-advancing cursor: ${nextPageTimestamp}.`,
        );
      }

      return yield* runPage(nextPageTimestamp, pageNumber + 1, nextState);
    });

    return yield* runPage(fight.startTime, 1, state);
  });

  const runCombinedArm = E.fnUntraced(function* (state: CostState) {
    const runPage = E.fnUntraced(function* (
      startTime: number,
      pageNumber: number,
      currentState: CostState,
    ): E.fn.Return<CostState, unknown, never> {
      const response = yield* query(
        {
          query: makeQuery({
            name: "ValidateCombinedEventsCost",
            selections: [COMBINED_EVENTS_SELECTION, RATE_LIMIT_DATA_SELECTION],
            variables: EVENT_VARIABLES,
          }),
          variables: {
            endTime: fight.endTime,
            reportCode,
            startTime,
          },
        },
        CombinedEventsResponseDataSchema,
      );
      const responseData = yield* getGraphQLResponseData(response);
      const report = responseData.reportData.report;

      if (report === null) {
        return yield* failValidation(
          `Fellowship Logs report "${reportCode}" was not found.`,
        );
      }

      const nextState = yield* recordResponse({
        arm: "combined",
        eventPages: { large: report.large, tiny: report.tiny },
        pageNumber,
        response,
        state: currentState,
      });
      const largeCursor = report.large.nextPageTimestamp;
      const tinyCursor = report.tiny.nextPageTimestamp;

      if (largeCursor === null && tinyCursor === null) {
        return nextState;
      }

      if (largeCursor !== tinyCursor) {
        return yield* failValidation(
          `Combined aliases returned different cursors: ${largeCursor} and ${tinyCursor}.`,
        );
      }

      if (largeCursor === null || largeCursor <= startTime) {
        return yield* failValidation(
          `Combined aliases returned a non-advancing cursor: ${largeCursor}.`,
        );
      }

      return yield* runPage(largeCursor, pageNumber + 1, nextState);
    });

    return yield* runPage(fight.startTime, 1, state);
  });

  const runSingles = E.fnUntraced(function* (state: CostState) {
    const afterLarge = yield* runSingleArm(
      "single-large",
      LARGE_SOURCE_ID,
      state,
    );

    return yield* runSingleArm("single-tiny", TINY_SOURCE_ID, afterLarge);
  });

  const finalState =
    phase === "before"
      ? yield* runCombinedArm(yield* runSingles(initialState))
      : yield* runSingles(yield* runCombinedArm(initialState));

  const equivalentArmPairs = [
    ["single-large", "combined-large"],
    ["single-tiny", "combined-tiny"],
  ] as const;

  yield* E.forEach(equivalentArmPairs, ([singleArm, combinedArm]) => {
    const singleEvents = finalState.eventsByArm[singleArm] ?? [];
    const combinedEvents = finalState.eventsByArm[combinedArm] ?? [];

    if (JSON.stringify(singleEvents) !== JSON.stringify(combinedEvents)) {
      return E.fail(
        failValidation(
          `${singleArm} and ${combinedArm} returned different events.`,
        ),
      );
    }

    return E.void;
  });

  const costsByArm = Object.fromEntries(
    ["single-large", "single-tiny", "combined"].map((arm) => {
      const cost = finalState.ledger
        .filter((entry) => {
          return entry.arm === arm;
        })
        .reduce((total, entry) => {
          return total + entry.requestCost;
        }, 0);

      return [arm, cost];
    }),
  );
  const summary = {
    additionalPoints: finalState.previousPoints - finalState.baselinePoints,
    baselinePoints: finalState.baselinePoints,
    costsByArm,
    eventCountsByArm: Object.fromEntries(
      Object.entries(finalState.eventsByArm).map(([arm, events]) => {
        return [arm, events.length];
      }),
    ),
    fightId,
    ledger: finalState.ledger,
    maxAdditionalPoints: MAX_ADDITIONAL_POINTS,
    phase,
    reportCode,
    sourceIds: {
      large: LARGE_SOURCE_ID,
      tiny: TINY_SOURCE_ID,
    },
  };

  yield* fileSystem.writeFileString(
    path.join(resolvedOutputDirectory, "summary.json"),
    stringifyJson(summary),
  );

  yield* E.logInfo("Validated Fellowship Logs event query costs.", {
    additionalPoints: summary.additionalPoints,
    costsByArm,
    outputDirectory: resolvedOutputDirectory,
    phase,
  });
});

const runValidateFellowshipLogsEventCostsCommand = E.fn(
  "runValidateFellowshipLogsEventCostsCommand",
)(function* (input: {
  readonly fightId: typeof FellowshipLogsFightIdSchema.Type;
  readonly outputDirectory: string;
  readonly phase: ValidationPhase;
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

  return yield* validateFellowshipLogsEventCosts({
    ...input,
    credentials: {
      clientId: clientIdOption.value,
      clientSecret: clientSecretOption.value,
    },
  });
});

export const validateFellowshipLogsEventCostsCommand = Command.make(
  "validate-fellowship-logs-event-costs",
  {
    fightId: Flag.Int("fight-id").pipe(
      Flag.withSchema(FellowshipLogsFightIdSchema),
      Flag.withDescription("Fight ID within the report."),
    ),
    outputDirectory: Flag.String("output").pipe(
      Flag.withAlias("o"),
      Flag.withSchema(NonEmptyStringSchema),
      Flag.withDefault("data/fellowship-logs-api-validation"),
      Flag.withDescription("Directory for raw responses and the cost ledger."),
    ),
    phase: Flag.String("phase").pipe(
      Flag.withDescription("Measurement phase, which also controls arm order."),
    ),
    reportCode: Flag.String("report-code").pipe(
      Flag.withSchema(FellowshipLogsReportCodeSchema),
      Flag.withDescription("Fellowship Logs report code."),
    ),
  },
  (input) => {
    return Schema.decodeUnknownEffect(ValidationPhaseSchema)(input.phase).pipe(
      E.flatMap((phase) => {
        return runValidateFellowshipLogsEventCostsCommand({ ...input, phase });
      }),
    );
  },
).pipe(
  Command.withDescription(
    "Compare separate and combined Fellowship Logs event query costs.",
  ),
  Command.provide(NodeHttpClientLayer),
);
