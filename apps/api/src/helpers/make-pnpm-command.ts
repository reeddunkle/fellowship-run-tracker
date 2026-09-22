import * as Config from "effect/Config";
import * as E from "effect/Effect";
import { ChildProcess } from "effect/unstable/process";

export function makePnpmCommand(
  args: ReadonlyArray<string>,
  options?: ChildProcess.CommandOptions,
): E.Effect<ChildProcess.Command> {
  if (process.platform !== "win32") {
    return E.succeed(ChildProcess.make("pnpm", args, options));
  }

  return E.gen(function* () {
    const comSpec = yield* Config.string("ComSpec").pipe(
      E.orElseSucceed(() => "cmd.exe"),
    );

    return ChildProcess.make(
      comSpec,
      ["/d", "/s", "/c", `pnpm ${args.join(" ")}`],
      options,
    );
  });
}
