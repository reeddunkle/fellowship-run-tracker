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
import { RATE_LIMIT_DATA_SELECTION } from "@frt/api/services/fellowship-logs-gateway/query/rate-limit-data-query.ts";
import { FellowshipLogsGatewayDungeonRunMetadataResponseDataSchema } from "@frt/api/services/fellowship-logs-gateway/validation/fellowship-logs-gateway-dungeon-run-metadata-schema.ts";
import { FellowshipLogsGatewayReportEventsSchema } from "@frt/api/services/fellowship-logs-gateway/validation/fellowship-logs-gateway-report-schema.ts";
import { FellowshipLogsFightIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { withRateLimitData } from "@frt/shared/fellowship-logs/fellowship-logs-rate-limit-schema.ts";
import { FellowshipLogsReportCodeSchema } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";
import {
  encodeJson,
  NonEmptyStringSchema,
  NonNegativeIntegerSchema,
} from "@frt/shared/util/common-schemas.ts";

const EncounterProbeFightSchema = Schema.Struct({
  difficultyLevel: Schema.Int.pipe(Schema.NullOr),
  encounterID: Schema.Int,
  endTime: NonNegativeIntegerSchema,
  id: Schema.Int,
  inProgress: Schema.Boolean,
  startTime: NonNegativeIntegerSchema,
});

const EncounterProbeResponseDataSchema = withRateLimitData({
  reportData: Schema.Struct({
    report: Schema.Struct({
      encounterEnds: FellowshipLogsGatewayReportEventsSchema,
      encounterStarts: FellowshipLogsGatewayReportEventsSchema,
      fights: Schema.Array(EncounterProbeFightSchema),
    }).pipe(Schema.NullOr),
  }),
});

const ENCOUNTER_PROBE_SELECTION = `
  reportData {
    report(code: $reportCode) {
      fights {
        id
        encounterID
        difficultyLevel
        startTime
        endTime
        inProgress
      }

      encounterStarts: events(
        startTime: $startTime
        endTime: $endTime
        filterExpression: "type = \\"encounterstart\\""
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
        filterExpression: "type = \\"encounterend\\""
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

const ENCOUNTER_PROBE_VARIABLES = [
  "$reportCode: String!",
  "$startTime: Float!",
  "$endTime: Float!",
];

type ProbeOptions = {
  readonly credentials: FellowshipLogsGatewayCredentials;
  readonly fightId: typeof FellowshipLogsFightIdSchema.Type;
  readonly outputFilePath: string;
  readonly reportCode: typeof FellowshipLogsReportCodeSchema.Type;
};

const probeFellowshipLogsEncounters = E.fn("probeFellowshipLogsEncounters")(
  function* ({
    credentials,
    fightId,
    outputFilePath,
    reportCode,
  }: ProbeOptions) {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;
    const query = yield* makeFellowshipLogsGatewayHttpQuery(() => {
      return E.succeed(credentials);
    });

    const metadataResponse = yield* query(
      {
        query: makeQuery({
          name: "GetEncounterProbeBounds",
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

    const probeResponse = yield* query(
      {
        query: makeQuery({
          name: "ProbeEncounterDataPaths",
          selections: [ENCOUNTER_PROBE_SELECTION, RATE_LIMIT_DATA_SELECTION],
          variables: ENCOUNTER_PROBE_VARIABLES,
        }),
        variables: {
          endTime: fight.endTime,
          reportCode,
          startTime: fight.startTime,
        },
      },
      EncounterProbeResponseDataSchema,
    );
    const probeData = yield* getGraphQLResponseData(probeResponse);
    const probeReport = yield* getReportOrFail({
      report: probeData.reportData.report,
      reportCode,
    });
    const overlappingFights = probeReport.fights.filter((candidate) => {
      return (
        candidate.startTime <= fight.endTime &&
        candidate.endTime >= fight.startTime
      );
    });
    const resolvedOutputPath = path.resolve(outputFilePath);
    const output = yield* encodeJson({
      fightBounds: fight,
      overlappingFights,
      response: probeResponse,
    });

    yield* fileSystem.makeDirectory(path.dirname(resolvedOutputPath), {
      recursive: true,
    });
    yield* fileSystem.writeFileString(resolvedOutputPath, `${output}\n`);

    yield* E.logInfo("Captured Fellowship Logs encounter path probe.", {
      encounterEndCount: probeReport.encounterEnds.data.length,
      encounterEndCursor: probeReport.encounterEnds.nextPageTimestamp,
      encounterStartCount: probeReport.encounterStarts.data.length,
      encounterStartCursor: probeReport.encounterStarts.nextPageTimestamp,
      outputFilePath: resolvedOutputPath,
      overlappingFightCount: overlappingFights.length,
      reportFightCount: probeReport.fights.length,
    });
  },
);

const runProbeFellowshipLogsEncountersCommand = E.fn(
  "runProbeFellowshipLogsEncountersCommand",
)(function* (input: {
  readonly fightId: typeof FellowshipLogsFightIdSchema.Type;
  readonly outputFilePath: string;
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
    outputFilePath: Flag.String("output").pipe(
      Flag.withAlias("o"),
      Flag.withSchema(NonEmptyStringSchema),
      Flag.withDefault("data/fellowship-logs-encounter-probe/result.json"),
      Flag.withDescription("Raw encounter probe evidence file."),
    ),
    reportCode: Flag.String("report-code").pipe(
      Flag.withSchema(FellowshipLogsReportCodeSchema),
      Flag.withDescription("Fellowship Logs report code."),
    ),
  },
  runProbeFellowshipLogsEncountersCommand,
).pipe(
  Command.withDescription(
    "Probe Fellowship Logs event and fight paths for encounter boundaries.",
  ),
  Command.provide(NodeHttpClientLayer),
);
