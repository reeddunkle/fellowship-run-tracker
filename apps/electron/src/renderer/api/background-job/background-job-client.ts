import * as E from "effect/Effect";

import { type BackgroundJobId } from "@frt/shared/validation/background-job/background-job-id-schema.ts";

import { AppApiClient } from "@/renderer/services/app-api-client/app-api-client";

export type BackgroundJobCommandArgs = {
  readonly id: BackgroundJobId;
};

export function getBackgroundJobs() {
  return E.gen(function* () {
    const client = yield* AppApiClient;

    return yield* client.backgroundJob.getBackgroundJobs();
  });
}

export function cancelBackgroundJob({ id }: BackgroundJobCommandArgs) {
  return E.gen(function* () {
    const client = yield* AppApiClient;

    yield* client.backgroundJob.cancelBackgroundJob({
      params: { jobId: id },
    });
  });
}

export function retryBackgroundJob({ id }: BackgroundJobCommandArgs) {
  return E.gen(function* () {
    const client = yield* AppApiClient;

    yield* client.backgroundJob.retryBackgroundJob({
      params: { jobId: id },
    });
  });
}

export function dismissBackgroundJob({ id }: BackgroundJobCommandArgs) {
  return E.gen(function* () {
    const client = yield* AppApiClient;

    yield* client.backgroundJob.dismissBackgroundJob({
      params: { jobId: id },
    });
  });
}
