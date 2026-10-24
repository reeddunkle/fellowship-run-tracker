import * as Layer from "effect/Layer";

import {
  BackgroundJob,
  type BackgroundJobShape,
} from "@frt/api/services/background-job/background-job-service.ts";
import {
  unexpectedEffectCall,
  unexpectedStreamCall,
} from "@frt/api/tests/common/mocks/unexpected-service-call.ts";

export type MakeBackgroundJobMockOptions = Partial<BackgroundJobShape>;

export function makeBackgroundJobMock({
  cancel = unexpectedEffectCall("BackgroundJob", "cancel"),
  changes = unexpectedStreamCall("BackgroundJob", "changes"),
  dismiss = unexpectedEffectCall("BackgroundJob", "dismiss"),
  getSnapshot = unexpectedEffectCall("BackgroundJob", "getSnapshot"),
  retry = unexpectedEffectCall("BackgroundJob", "retry"),
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
