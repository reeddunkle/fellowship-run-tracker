import { parseArgs } from "node:util";
import * as E from "effect/Effect";
import * as Match from "effect/Match";

import { validateNoExtraPositionals } from "@/cli/util/validate-no-extra-positionals.ts";
import {
  CliArgumentParseError,
  UnknownCliCommandError,
} from "@/errors/cli-error.ts";

type ParsedArguments = ReturnType<typeof parseArgs>;

type ServeCommand = {
  readonly type: "SERVE";
};

export type ApiCLICommand = ServeCommand;

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
        },
        strict: true,
      });
    },
  });
}

export function parseApiCLICommand(
  args: ReadonlyArray<string>,
): E.Effect<ApiCLICommand, Error> {
  return E.gen(function* () {
    const parsedArguments = yield* parseArguments(args);
    const [commandName] = parsedArguments.positionals;

    return yield* Match.value(commandName).pipe(
      Match.when("serve", () =>
        E.gen(function* () {
          yield* validateNoExtraPositionals(parsedArguments.positionals);

          return {
            type: "SERVE",
          } as const;
        }),
      ),
      Match.orElse((unknownCommand) => {
        return E.fail(
          new UnknownCliCommandError({
            cli: "Api",
            commandName: unknownCommand,
          }),
        );
      }),
    );
  });
}
