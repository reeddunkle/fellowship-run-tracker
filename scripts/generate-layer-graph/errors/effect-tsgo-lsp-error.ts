import * as Data from "effect/Data";

export class EffectTsGoLspWorkspaceError extends Data.TaggedError(
  "EffectTsGoLspWorkspaceError",
)<{
  readonly message: string;
  readonly cause: unknown;
}> {}

export class EffectTsGoLspExecutableError extends Data.TaggedError(
  "EffectTsGoLspExecutableError",
)<{
  readonly message: string;
  readonly cause: unknown;
}> {}

export class EffectTsGoLspProcessError extends Data.TaggedError(
  "EffectTsGoLspProcessError",
)<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class EffectTsGoLspProtocolError extends Data.TaggedError(
  "EffectTsGoLspProtocolError",
)<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

export class EffectTsGoLspSourceFileError extends Data.TaggedError(
  "EffectTsGoLspSourceFileError",
)<{
  readonly message: string;
  readonly sourceFile: string;
}> {}

export type EffectTsGoLspError =
  | EffectTsGoLspExecutableError
  | EffectTsGoLspProcessError
  | EffectTsGoLspProtocolError
  | EffectTsGoLspSourceFileError
  | EffectTsGoLspWorkspaceError;
