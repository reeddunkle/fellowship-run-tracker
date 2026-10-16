import * as A from "effect/Array";
import * as Cache from "effect/Cache";
import * as Duration from "effect/Duration";
import * as E from "effect/Effect";
import * as Exit from "effect/Exit";
import * as FileSystem from "effect/FileSystem";
import { pipe } from "effect/Function";
import * as Option from "effect/Option";
import * as Order from "effect/Order";
import * as Path from "effect/Path";
import * as R from "effect/Record";
import * as Schema from "effect/Schema";

import { FellowshipLogsGatewayRequestError } from "@frt/api/errors/fellowship-logs-gateway-error.ts";
import {
  getFellowshipLogsGatewayReportFixtureDirectory,
  getFellowshipLogsGatewayReportFixtureDirectoryPrefix,
} from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-fixture-paths.ts";
import { type Query } from "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-service.ts";
import { normalizeFellowshipLogsGatewayReport } from "@frt/api/services/fellowship-logs-gateway/normalize-fellowship-logs-gateway-report.ts";
import { FellowshipLogsGatewayDungeonRunMetadataResponseDataSchema } from "@frt/api/services/fellowship-logs-gateway/validation/fellowship-logs-gateway-dungeon-run-metadata-schema.ts";
import {
  type FellowshipLogsGatewayGraphQLRequest,
  makeFellowshipLogsGatewayGraphQLResponseSchema,
} from "@frt/api/services/fellowship-logs-gateway/validation/fellowship-logs-gateway-graphql-schema.ts";
import { FellowshipLogsGatewayReportResponseDataSchema } from "@frt/api/services/fellowship-logs-gateway/validation/fellowship-logs-gateway-report-schema.ts";
import { FellowshipLogsFightIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { FellowshipLogsReportCodeSchema } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";
import { PositiveIntegerFromStringSchema } from "@frt/shared/util/common-schemas.ts";

type MakeFellowshipLogsGatewayFileQueryOptions = {
  readonly fixtureDirectory: string;
};

const METADATA_FILENAME = "metadata.json";

const FIXTURE_DIRECTORY_MARKER = "-fights-";

const FIGHT_PAGES_CACHE_CAPACITY = 64;

const UnknownJsonSchema = Schema.fromJsonString(Schema.Unknown);

const MetadataResponseSchema = makeFellowshipLogsGatewayGraphQLResponseSchema(
  FellowshipLogsGatewayDungeonRunMetadataResponseDataSchema,
);

const ReportPageResponseSchema = makeFellowshipLogsGatewayGraphQLResponseSchema(
  FellowshipLogsGatewayReportResponseDataSchema,
);

const FightRequestVariablesSchema = Schema.Struct({
  fightId: FellowshipLogsFightIdSchema,
  reportCode: FellowshipLogsReportCodeSchema,
});

const ReportPageRequestVariablesSchema = Schema.Struct({
  reportCode: FellowshipLogsReportCodeSchema,
  startTime: Schema.Finite,
});

const PageFilenameSchema = Schema.TemplateLiteralParser([
  "page-",
  PositiveIntegerFromStringSchema,
  ".json",
]);

type PageFile = {
  readonly filename: string;
  readonly pageNumber: number;
};

const byPageNumber = Order.mapInput(Order.Number, (pageFile: PageFile) => {
  return pageFile.pageNumber;
});

function getOperationName(query: string) {
  return /^\s*query(?:\s+(\w+))?/.exec(query)?.[1];
}

function mapFixtureError(cause: unknown) {
  return new FellowshipLogsGatewayRequestError({
    cause,
    operation: "ReadFixture",
  });
}

function failFixture(message: string) {
  return E.fail(mapFixtureError(new Error(message)));
}

export const makeFellowshipLogsGatewayFileQuery = E.fnUntraced(function* ({
  fixtureDirectory,
}: MakeFellowshipLogsGatewayFileQueryOptions) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const readJson = E.fnUntraced(function* (filePath: string) {
    const contents = yield* fileSystem.readFileString(filePath);

    return yield* Schema.decodeEffect(UnknownJsonSchema)(contents);
  });

  const readMetadata = (fightDirectory: string) => {
    return readJson(path.join(fightDirectory, METADATA_FILENAME));
  };

  const getPageFiles = E.fnUntraced(function* (fightDirectory: string) {
    const filenames = yield* fileSystem.readDirectory(fightDirectory);

    const pageFiles = yield* E.forEach(filenames, (filename) => {
      return Schema.decodeUnknownEffect(PageFilenameSchema)(filename).pipe(
        E.option,
        E.map(
          Option.map(([, pageNumber]): PageFile => {
            return { filename, pageNumber };
          }),
        ),
      );
    });

    return pipe(pageFiles, A.flatMap(Option.toArray), A.sort(byPageNumber));
  });

  const getNextPageTimestamp = E.fnUntraced(function* (page: unknown) {
    const response = yield* Schema.decodeUnknownEffect(
      ReportPageResponseSchema,
    )(page);
    const report = response.data?.reportData.report;

    if (report === undefined || report === null) {
      return yield* failFixture("A recorded page has no report data.");
    }

    const normalizedReport =
      yield* normalizeFellowshipLogsGatewayReport(report);

    return normalizedReport.events.nextPageTimestamp;
  });

  const readFightPages = E.fnUntraced(function* (fightDirectory: string) {
    const metadata = yield* readMetadata(fightDirectory).pipe(
      E.flatMap(Schema.decodeUnknownEffect(MetadataResponseSchema)),
    );
    const fight = metadata.data?.reportData.report?.fights[0];

    if (fight === undefined) {
      return yield* failFixture(
        `The fixture in ${fightDirectory} has no fight metadata.`,
      );
    }

    const pageFiles = yield* getPageFiles(fightDirectory);

    const pages = yield* E.forEach(pageFiles, ({ filename }) => {
      return readJson(path.join(fightDirectory, filename));
    });

    const nextPageTimestamps = yield* E.forEach(pages, getNextPageTimestamp);

    const startTimes = [fight.startTime, ...nextPageTimestamps.slice(0, -1)];

    if (startTimes.includes(null)) {
      return yield* failFixture(
        `A non-terminal page in ${fightDirectory} has no next page timestamp.`,
      );
    }

    return new Map(A.zip(startTimes, pages));
  });

  const fightPagesCache = yield* Cache.makeWith(readFightPages, {
    capacity: FIGHT_PAGES_CACHE_CAPACITY,
    timeToLive: (exit) => {
      return Exit.isSuccess(exit) ? Duration.infinity : Duration.zero;
    },
  });

  const getFightDirectories = E.fnUntraced(function* (
    isFightDirectory: (name: string) => boolean,
  ) {
    const names = yield* fileSystem.readDirectory(fixtureDirectory);

    return pipe(
      names,
      A.filter(isFightDirectory),
      A.sort(Order.String),
      A.map((name) => {
        return path.join(fixtureDirectory, name);
      }),
    );
  });

  const readFightMetadataBody = E.fnUntraced(function* (variables: unknown) {
    const options = yield* Schema.decodeUnknownEffect(
      FightRequestVariablesSchema,
    )(variables);

    return yield* readMetadata(
      getFellowshipLogsGatewayReportFixtureDirectory({
        fixtureDirectory,
        options,
        path,
      }),
    );
  });

  const readReportPageBody = E.fnUntraced(function* (variables: unknown) {
    const { reportCode, startTime } = yield* Schema.decodeUnknownEffect(
      ReportPageRequestVariablesSchema,
    )(variables);

    const prefix =
      getFellowshipLogsGatewayReportFixtureDirectoryPrefix(reportCode);

    const fightDirectories = yield* getFightDirectories((name) => {
      return name.startsWith(prefix);
    });

    const fightPages = yield* E.forEach(fightDirectories, (fightDirectory) => {
      return Cache.get(fightPagesCache, fightDirectory);
    });

    const page = fightPages
      .map((pagesByStartTime) => {
        return pagesByStartTime.get(startTime);
      })
      .find((candidate) => {
        return candidate !== undefined;
      });

    if (page === undefined) {
      return yield* failFixture(
        `No recorded page for ${reportCode} at ${startTime}.`,
      );
    }

    return page;
  });

  const readRateLimitDataBody = E.fnUntraced(function* () {
    const fightDirectories = yield* getFightDirectories((name) => {
      return name.includes(FIXTURE_DIRECTORY_MARKER);
    });

    const firstFightDirectory = fightDirectories[0];

    if (firstFightDirectory === undefined) {
      return yield* failFixture(`No recorded fights in ${fixtureDirectory}.`);
    }

    const metadata = yield* readMetadata(firstFightDirectory).pipe(
      E.flatMap(Schema.decodeUnknownEffect(MetadataResponseSchema)),
    );

    return {
      data: { rateLimitData: metadata.data?.rateLimitData },
    };
  });

  const readOperationBodies: R.ReadonlyRecord<
    string,
    typeof readFightMetadataBody | typeof readReportPageBody
  > = {
    GetDungeonRunMetadata: readFightMetadataBody,
    GetDungeonRunReport: readReportPageBody,
    GetFight: readFightMetadataBody,
  };

  const readResponseBody = (request: FellowshipLogsGatewayGraphQLRequest) => {
    const operationName = getOperationName(request.query);

    if (operationName === undefined) {
      return readRateLimitDataBody();
    }

    return Option.match(R.get(readOperationBodies, operationName), {
      onNone: () => {
        return failFixture(`No fixture for the ${operationName} operation.`);
      },
      onSome: (readOperationBody) => {
        return readOperationBody(request.variables);
      },
    });
  };

  const query: Query = E.fnUntraced(
    function* (request, responseSchema) {
      const body = yield* readResponseBody(request);

      return yield* Schema.decodeUnknownEffect(
        makeFellowshipLogsGatewayGraphQLResponseSchema(responseSchema),
      )(body);
    },
    E.catchTag(["PlatformError", "SchemaError"], (error) => {
      return mapFixtureError(error).pipe(E.fail);
    }),
  );

  return query;
});
