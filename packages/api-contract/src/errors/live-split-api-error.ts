import * as Schema from "effect/Schema";

export class LiveSplitApiConnectionError extends Schema.TaggedError<LiveSplitApiConnectionError>()(
  "LiveSplitApiConnectionError",
  {},
  { httpApiStatus: 503 },
) {
  override get message() {
    return "Could not connect to LiveSplit. Make sure LiveSplit is running and its server is enabled.";
  }
}
