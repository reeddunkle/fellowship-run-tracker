import * as Data from "effect/Data";

const SYSTEM_BROWSER_REASON_DESCRIPTIONS = {
  LaunchFailed: "The system browser could not be opened.",
  Unavailable: "This runtime cannot open the system browser.",
} as const;

export class SystemBrowserError extends Data.TaggedError("SystemBrowserError")<{
  readonly reason: keyof typeof SYSTEM_BROWSER_REASON_DESCRIPTIONS;
}> {
  override get message() {
    return SYSTEM_BROWSER_REASON_DESCRIPTIONS[this.reason];
  }
}
