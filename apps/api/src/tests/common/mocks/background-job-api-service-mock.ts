import * as E from "effect/Effect";
import * as Layer from "effect/Layer";

import {
  BackgroundJobApiService,
  type BackgroundJobApiServiceShape,
} from "@frt/api/services/api/background-job/background-job-api-service.ts";

export type MakeBackgroundJobApiServiceMockOptions =
  Partial<BackgroundJobApiServiceShape>;

export function makeBackgroundJobApiServiceMock({
  cancel = () => {
    return E.void;
  },
  dismiss = () => {
    return E.void;
  },
  getSnapshot = () => {
    return E.succeed({ jobs: [], revision: 0, sessionId: "test" });
  },
  retry = () => {
    return E.void;
  },
}: MakeBackgroundJobApiServiceMockOptions = {}) {
  return Layer.succeed(BackgroundJobApiService, {
    cancel,
    dismiss,
    getSnapshot,
    retry,
  } satisfies BackgroundJobApiServiceShape);
}

export const BackgroundJobApiServiceMock = makeBackgroundJobApiServiceMock();
