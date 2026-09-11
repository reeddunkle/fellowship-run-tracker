import * as E from "effect/Effect";

import { UnexpectedCliPositionalsError } from "@/errors/cli-error.ts";

export function validateNoExtraPositionals(
  positionals: ReadonlyArray<string>,
): E.Effect<void, UnexpectedCliPositionalsError> {
  const [, ...extraPositionals] = positionals;

  if (extraPositionals.length === 0) {
    return E.void;
  }

  return E.fail(
    new UnexpectedCliPositionalsError({
      positionals: extraPositionals,
    }),
  );
}
