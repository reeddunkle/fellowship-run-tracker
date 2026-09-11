import * as Data from "effect/Data";

export class CliArgumentParseError extends Data.TaggedError(
  "CliArgumentParseError",
)<{
  readonly cause: unknown;
}> {}

export class UnexpectedCliPositionalsError extends Data.TaggedError(
  "UnexpectedCliPositionalsError",
)<{
  readonly positionals: ReadonlyArray<string>;
}> {
  override get message() {
    return `Unexpected positional arguments: ${this.positionals.join(", ")}`;
  }
}

export class UnknownCliCommandError extends Data.TaggedError(
  "UnknownCliCommandError",
)<{
  readonly commandName: string | undefined;
  readonly cli: "Api" | "Dev" | "Public";
}> {
  override get message() {
    const commandName = this.commandName ?? "(missing)";

    return `Unknown ${this.cli.toLowerCase()} CLI command: ${commandName}`;
  }
}
