import * as Data from "effect/Data";

const WORKSPACE_OPERATION_DESCRIPTIONS = {
  CopySourceTree: "copy the source tree into the Effect TS-Go workspace",
  CreateWorkspace: "create the Effect TS-Go workspace",
  ResolveProjectRoot: "resolve the project root",
  WriteTsConfig: "write the Effect TS-Go workspace tsconfig",
} as const;

export class EffectTsGoLspWorkspaceError extends Data.TaggedError(
  "EffectTsGoLspWorkspaceError",
)<{
  readonly cause: unknown;
  readonly operation: keyof typeof WORKSPACE_OPERATION_DESCRIPTIONS;
}> {
  override get message() {
    return `Failed to ${WORKSPACE_OPERATION_DESCRIPTIONS[this.operation]}.`;
  }
}

/** `description` explains which native `@effect/tsgo` dependency is expected. */
export class EffectTsGoLspExecutableError extends Data.TaggedError(
  "EffectTsGoLspExecutableError",
)<{
  readonly cause: unknown;
  readonly description: string;
}> {
  override get message() {
    return `Failed to resolve the Effect TS-Go executable. ${this.description}`;
  }
}

const PROCESS_OPERATION_DESCRIPTIONS = {
  Launch: "Failed to launch the Effect TS-Go LSP.",
  ReadOutput: "Effect TS-Go LSP output stream failed.",
  WaitForExit: "Failed while waiting for the Effect TS-Go LSP process.",
} as const;

/**
 * `exitCode` is set when the LSP process exited; `description` adds detail
 * (e.g. the expected native dependency when launching fails).
 */
export class EffectTsGoLspProcessError extends Data.TaggedError(
  "EffectTsGoLspProcessError",
)<{
  readonly cause?: unknown;
  readonly description?: string;
  readonly exitCode?: number;
  readonly operation: keyof typeof PROCESS_OPERATION_DESCRIPTIONS | "Exit";
}> {
  override get message() {
    const message =
      this.operation === "Exit"
        ? `Effect TS-Go LSP exited with code ${this.exitCode}.`
        : PROCESS_OPERATION_DESCRIPTIONS[this.operation];

    return this.description === undefined
      ? message
      : `${message} ${this.description}`;
  }
}

const PROTOCOL_OPERATION_DESCRIPTIONS = {
  ParseMessage: "Failed to parse a message from the Effect TS-Go LSP.",
  ReadHeader: "Effect TS-Go LSP message is missing its Content-Length header.",
  WriteMessage: "Failed to write a message to the Effect TS-Go LSP.",
} as const;

/** `header` is the raw message header when it couldn't be read. */
export class EffectTsGoLspProtocolError extends Data.TaggedError(
  "EffectTsGoLspProtocolError",
)<{
  readonly cause?: unknown;
  readonly header?: string;
  readonly operation: keyof typeof PROTOCOL_OPERATION_DESCRIPTIONS;
}> {
  override get message() {
    const message = PROTOCOL_OPERATION_DESCRIPTIONS[this.operation];

    return this.header === undefined
      ? message
      : `${message}
${this.header}`;
  }
}

export class EffectTsGoLspSourceFileError extends Data.TaggedError(
  "EffectTsGoLspSourceFileError",
)<{
  readonly sourceFile: string;
}> {
  override get message() {
    return `Source file is outside the project root: ${this.sourceFile}`;
  }
}

export type EffectTsGoLspError =
  | EffectTsGoLspExecutableError
  | EffectTsGoLspProcessError
  | EffectTsGoLspProtocolError
  | EffectTsGoLspSourceFileError
  | EffectTsGoLspWorkspaceError;
