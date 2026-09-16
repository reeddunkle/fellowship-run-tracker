import { parseArgs } from "node:util";
import * as E from "effect/Effect";
import * as Match from "effect/Match";
import * as Schema from "effect/Schema";

import { validateNoExtraPositionals } from "@/cli/util/validate-no-extra-positionals.ts";
import {
  CliArgumentParseError,
  UnknownCliCommandError,
} from "@/errors/cli-error.ts";

import { BuildMilestoneConfigurationJsonSchemaCommandInputSchema } from "./commands/build-milestone-configuration-json-schema-command.ts";
import { CaptureFellowshipLogsReportCommandInputSchema } from "./commands/capture-fellowship-logs-report-command.ts";
import { GenerateFellowshipUnitCatalogCommandInputSchema } from "./commands/generate-fellowship-unit-catalog-command.ts";
import {
  ReplayLogFileArgumentsSchema,
  ReplayLogFileCommandInputSchema,
} from "./commands/replay-log-file-command.ts";

const PARSE_ARGS_OPTIONS = {
  "fight-id": {
    type: "string",
  },
  "initial-delay": {
    type: "string",
  },
  input: {
    short: "i",
    type: "string",
  },
  "max-delay": {
    type: "string",
  },
  output: {
    short: "o",
    type: "string",
  },
  "report-code": {
    type: "string",
  },
  speed: {
    short: "s",
    type: "string",
  },
} as const;

function parseArgumentsUnsafe(args: ReadonlyArray<string>) {
  return parseArgs({
    allowPositionals: true,
    args: [...args],
    options: PARSE_ARGS_OPTIONS,
    strict: true,
  });
}

type ParsedArguments = ReturnType<typeof parseArgumentsUnsafe>;

type BuildConfigurationSchemaCommand = {
  readonly input: Schema.Schema.Type<
    typeof BuildMilestoneConfigurationJsonSchemaCommandInputSchema
  >;
  readonly type: "BUILD_CONFIGURATION_SCHEMA";
};

type CaptureFellowshipLogsReportCommand = {
  readonly input: Schema.Schema.Type<
    typeof CaptureFellowshipLogsReportCommandInputSchema
  >;
  readonly type: "CAPTURE_FELLOWSHIP_LOGS_REPORT";
};

type GenerateUnitCatalogCommand = {
  readonly input: Schema.Schema.Type<
    typeof GenerateFellowshipUnitCatalogCommandInputSchema
  >;
  readonly type: "GENERATE_UNIT_CATALOG";
};

type ReplayLogCommand = {
  readonly input: Schema.Schema.Type<typeof ReplayLogFileCommandInputSchema>;
  readonly type: "REPLAY_LOG";
};

type SetupDatabaseCommand = {
  readonly type: "SETUP_DATABASE";
};

export type DevCLICommand =
  | BuildConfigurationSchemaCommand
  | CaptureFellowshipLogsReportCommand
  | GenerateUnitCatalogCommand
  | ReplayLogCommand
  | SetupDatabaseCommand;

function includeWhenDefined<Key extends string, Value>(
  key: Key,
  value: Value | undefined,
): Partial<Record<Key, Value>> {
  return value === undefined
    ? {}
    : ({
        [key]: value,
      } as Record<Key, Value>);
}

function parseArguments(
  args: ReadonlyArray<string>,
): E.Effect<ParsedArguments, Error> {
  return E.try({
    catch: (cause) => {
      return new CliArgumentParseError({
        cause,
      });
    },
    try: () => {
      return parseArgumentsUnsafe(args);
    },
  });
}

function parseBuildMilestoneConfigurationJsonSchemaInput({
  positionals,
  values,
}: ParsedArguments) {
  return E.gen(function* () {
    yield* validateNoExtraPositionals(positionals);

    return yield* Schema.decodeEffect(
      BuildMilestoneConfigurationJsonSchemaCommandInputSchema,
    )({
      ...includeWhenDefined("outputFilePath", values.output),
    });
  });
}

function parseCaptureFellowshipLogsReportInput({
  positionals,
  values,
}: ParsedArguments) {
  return E.gen(function* () {
    yield* validateNoExtraPositionals(positionals);

    const fightId =
      values["fight-id"] === undefined ? undefined : Number(values["fight-id"]);

    return yield* Schema.decodeUnknownEffect(
      CaptureFellowshipLogsReportCommandInputSchema,
    )({
      fightId,
      ...includeWhenDefined("outputFilePath", values.output),
      reportCode: values["report-code"],
    });
  });
}

function parseGenerateFellowshipUnitCatalogInput({
  positionals,
  values,
}: ParsedArguments) {
  return E.gen(function* () {
    yield* validateNoExtraPositionals(positionals);

    return yield* Schema.decodeUnknownEffect(
      GenerateFellowshipUnitCatalogCommandInputSchema,
    )({
      inputFilePath: values.input,
    });
  });
}

function parseReplayLogFileInput({ positionals, values }: ParsedArguments) {
  return E.gen(function* () {
    yield* validateNoExtraPositionals(positionals);

    const arguments_ = yield* Schema.decodeUnknownEffect(
      ReplayLogFileArgumentsSchema,
    )({
      inputFilePath: values.input,
      outputFilePath: values.output,
      ...includeWhenDefined(
        "initialDelayMilliseconds",
        values["initial-delay"],
      ),
      ...includeWhenDefined("maxDelayMilliseconds", values["max-delay"]),
      ...includeWhenDefined("speed", values.speed),
    });

    return yield* Schema.decodeEffect(ReplayLogFileCommandInputSchema)({
      initialDelayMilliseconds: arguments_.initialDelayMilliseconds ?? 1_000,
      inputFilePath: arguments_.inputFilePath,
      maxDelayMilliseconds: arguments_.maxDelayMilliseconds ?? 10_000,
      outputFilePath: arguments_.outputFilePath,
      speed: arguments_.speed ?? 1,
    });
  });
}

export function parseDevCLICommand(
  args: ReadonlyArray<string>,
): E.Effect<DevCLICommand, unknown> {
  return E.gen(function* () {
    const parsedArguments = yield* parseArguments(args);
    const [commandName] = parsedArguments.positionals;

    return yield* Match.value(commandName).pipe(
      Match.when("build-configuration-schema", () =>
        E.gen(function* () {
          const input =
            yield* parseBuildMilestoneConfigurationJsonSchemaInput(
              parsedArguments,
            );

          return {
            input,
            type: "BUILD_CONFIGURATION_SCHEMA",
          } as const;
        }),
      ),
      Match.when("capture-fellowship-logs-report", () =>
        E.gen(function* () {
          const input =
            yield* parseCaptureFellowshipLogsReportInput(parsedArguments);

          return {
            input,
            type: "CAPTURE_FELLOWSHIP_LOGS_REPORT",
          } as const;
        }),
      ),
      Match.when("generate-unit-catalog", () =>
        E.gen(function* () {
          const input =
            yield* parseGenerateFellowshipUnitCatalogInput(parsedArguments);

          return {
            input,
            type: "GENERATE_UNIT_CATALOG",
          } as const;
        }),
      ),
      Match.when("replay-log", () =>
        E.gen(function* () {
          const input = yield* parseReplayLogFileInput(parsedArguments);

          return {
            input,
            type: "REPLAY_LOG",
          } as const;
        }),
      ),
      Match.when("setup-database", () =>
        E.gen(function* () {
          yield* validateNoExtraPositionals(parsedArguments.positionals);

          return {
            type: "SETUP_DATABASE",
          } as const;
        }),
      ),
      Match.orElse((unknownCommand) => {
        return E.fail(
          new UnknownCliCommandError({
            cli: "Dev",
            commandName: unknownCommand,
          }),
        );
      }),
    );
  });
}
