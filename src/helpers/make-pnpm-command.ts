import { ChildProcess } from "effect/unstable/process";

export function makePnpmCommand(
  args: ReadonlyArray<string>,
  options?: ChildProcess.CommandOptions,
): ChildProcess.Command {
  if (process.platform === "win32") {
    return ChildProcess.make(
      process.env.ComSpec ?? "cmd.exe",
      ["/d", "/s", "/c", `pnpm ${args.join(" ")}`],
      options,
    );
  }

  return ChildProcess.make("pnpm", args, options);
}
