import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Stream from "effect/Stream";

import {
  BackgroundJob,
  type BackgroundJobShape,
} from "@frt/api/services/background-job/background-job-service.ts";

export type MakeBackgroundJobMockOptions = Partial<BackgroundJobShape>;

export function makeBackgroundJobMock({
  cancel = () => {
    return E.void;
  },
  changes = Stream.empty,
  dismiss = () => {
    return E.void;
  },
  getSnapshot = () => {
    return E.succeed({ jobs: [], revision: 0, sessionId: "test" });
  },
  retry = () => {
    return E.void;
  },
}: MakeBackgroundJobMockOptions = {}) {
  return Layer.succeed(BackgroundJob, {
    cancel,
    changes,
    dismiss,
    getSnapshot,
    retry,
  } satisfies BackgroundJobShape);
}

export const BackgroundJobMock = makeBackgroundJobMock();
