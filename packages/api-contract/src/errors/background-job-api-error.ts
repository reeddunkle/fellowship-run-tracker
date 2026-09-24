import * as Schema from "effect/Schema";

import { BackgroundJobIdSchema } from "@frt/shared/background-job/background-job-id-schema.ts";

export class BackgroundJobApiNotFoundError extends Schema.TaggedError<BackgroundJobApiNotFoundError>()(
  "BackgroundJobApiNotFoundError",
  {
    id: BackgroundJobIdSchema,
  },
  { httpApiStatus: 404 },
) {
  override get message() {
    return "That job no longer exists or has already moved on.";
  }
}
