import * as E from "effect/Effect";
import { ChildProcessSpawner } from "effect/process";

import { BiomeFixError } from "@frt/api/errors/biome-fix-error.ts";
import { makePnpmCommand } from "@frt/api/helpers/make-pnpm-command.ts";

export const fixWithBiome: (
  filePaths: ReadonlyArray<string>,
) => E.Effect<void, BiomeFixError, ChildProcessSpawner.ChildProcessSpawner> =
  E.fn("fixWithBiome")(function* (filePaths) {
    const childProcessSpawner = yield* ChildProcessSpawner.ChildProcessSpawner;

    const command = yield* makePnpmCommand([
      "exec",
      "biome",
      "check",
      "--write",
      ...filePaths,
    ]);

    yield* childProcessSpawner.string(command).pipe(
      E.asVoid,
      E.mapError((cause) => {
        return new BiomeFixError({
          cause,
          filePaths,
        });
      }),
    );
  });
