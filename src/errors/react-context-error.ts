import * as Data from "effect/Data";

export class ReactContextError extends Data.TaggedError("ReactContextError")<{
  readonly hookName: string;
  readonly providerName: string;
}> {
  override get message() {
    return `${this.hookName} must be used within ${this.providerName}.`;
  }
}
