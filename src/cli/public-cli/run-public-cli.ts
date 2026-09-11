import { parseArgs } from "node:util";
import * as E from "effect/Effect";
import * as Match from "effect/Match";
import * as Schema from "effect/Schema";

import { AutosplitCommandInputSchema } from "@/cli/public-cli/commands/autosplit-command.ts";
import { FilterLogCommandInputSchema } from "@/cli/public-cli/commands/filter-log-command.ts";
import { GenerateLSSCommandInputSchema } from "@/cli/public-cli/commands/generate-lss-command.ts";
import { SplitLogCommandInputSchema } from "@/cli/public-cli/commands/split-log-command.ts";
import { validateNoExtraPositionals } from "@/cli/util/validate-no-extra-positionals.ts";
import {
  CliArgumentParseError,
  UnknownCliCommandError,
} from "@/errors/cli-error.ts";

type ParsedArguments = ReturnType<typeof parseArgs>;

type AutosplitCommand = {
  readonly input: Schema.Schema.Type<typeof AutosplitCommandInputSchema>;
  readonly type: "AUTOSPLIT";
};

type FilterLogCommand = {
  readonly input: Schema.Schema.Type<typeof FilterLogCommandInputSchema>;
  readonly type: "FILTER_LOG";
};

type GenerateLSSCommand = {
  readonly input: Schema.Schema.Type<typeof GenerateLSSCommandInputSchema>;
  readonly type: "GENERATE_LSS";
};

type SplitLogCommand = {
  readonly input: Schema.Schema.Type<typeof SplitLogCommandInputSchema>;
  readonly type: "SPLIT_LOG";
};

export type PublicCLICommand =
  | AutosplitCommand
  | FilterLogCommand
  | GenerateLSSCommand
  | SplitLogCommand;

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
      return parseArgs({
        allowPositionals: true,
        args: [...args],
        options: {
          configuration: {
            short: "c",
            type: "string",
          },
          log: {
            short: "l",
            type: "string",
          },
          output: {
            short: "o",
            type: "string",
          },
        },
        strict: true,
      });
    },
  });
}

function parseAutosplitInput({ positionals, values }: ParsedArguments) {
  return E.gen(function* () {
    yield* validateNoExtraPositionals(positionals);

    return yield* Schema.decodeUnknownEffect(AutosplitCommandInputSchema)({
      configurationFilePath: values.configuration,
    });
  });
}

function parseFilterLogInput({ positionals, values }: ParsedArguments) {
  return E.gen(function* () {
    yield* validateNoExtraPositionals(positionals);

    return yield* Schema.decodeUnknownEffect(FilterLogCommandInputSchema)({
      inputFilePath: values.log,
      outputFilePath: values.output,
    });
  });
}

function parseGenerateLSSInput({ positionals, values }: ParsedArguments) {
  return E.gen(function* () {
    yield* validateNoExtraPositionals(positionals);

    return yield* Schema.decodeUnknownEffect(GenerateLSSCommandInputSchema)({
      configurationFilePath: values.configuration,
      outputFilePath: values.output,
    });
  });
}

function parseSplitLogInput({ positionals, values }: ParsedArguments) {
  return E.gen(function* () {
    yield* validateNoExtraPositionals(positionals);

    return yield* Schema.decodeUnknownEffect(SplitLogCommandInputSchema)({
      inputFilePath: values.log,
      outputDirectoryPath: values.output,
    });
  });
}

export function parsePublicCLICommand(
  args: ReadonlyArray<string>,
): E.Effect<PublicCLICommand, unknown> {
  return E.gen(function* () {
    const parsedArguments = yield* parseArguments(args);
    const [commandName] = parsedArguments.positionals;

    return yield* Match.value(commandName).pipe(
      Match.when("autosplit", () =>
        E.gen(function* () {
          const input = yield* parseAutosplitInput(parsedArguments);

          return {
            input,
            type: "AUTOSPLIT",
          } as const;
        }),
      ),
      Match.when("filter-log", () =>
        E.gen(function* () {
          const input = yield* parseFilterLogInput(parsedArguments);

          return {
            input,
            type: "FILTER_LOG",
          } as const;
        }),
      ),
      Match.when("generate-lss", () =>
        E.gen(function* () {
          const input = yield* parseGenerateLSSInput(parsedArguments);

          return {
            input,
            type: "GENERATE_LSS",
          } as const;
        }),
      ),
      Match.when("split-log", () =>
        E.gen(function* () {
          const input = yield* parseSplitLogInput(parsedArguments);

          return {
            input,
            type: "SPLIT_LOG",
          } as const;
        }),
      ),
      Match.orElse((unknownCommand) => {
        return E.fail(
          new UnknownCliCommandError({
            cli: "Public",
            commandName: unknownCommand,
          }),
        );
      }),
    );
  });
}
