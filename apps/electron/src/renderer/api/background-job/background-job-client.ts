import * as E from "effect/Effect";

import { type BackgroundJobId } from "@frt/shared/background-job/background-job-id-schema.ts";

import { AppApiClient } from "@/renderer/services/app-api-client/app-api-client.ts";

export type BackgroundJobCommandArgs = {
  readonly id: BackgroundJobId;
};

export const getBackgroundJobs = E.fn(
  "BackgroundJobApiClient.getBackgroundJobs",
)(function* () {
  const client = yield* AppApiClient;

  return yield* client.backgroundJob.getBackgroundJobs();
});

export const cancelBackgroundJob = E.fn(
  "BackgroundJobApiClient.cancelBackgroundJob",
)(function* ({ id }: BackgroundJobCommandArgs) {
  const client = yield* AppApiClient;

  yield* client.backgroundJob.cancelBackgroundJob({
    params: { jobId: id },
  });
});

export const retryBackgroundJob = E.fn(
  "BackgroundJobApiClient.retryBackgroundJob",
)(function* ({ id }: BackgroundJobCommandArgs) {
  const client = yield* AppApiClient;

  yield* client.backgroundJob.retryBackgroundJob({
    params: { jobId: id },
  });
});

export const dismissBackgroundJob = E.fn(
  "BackgroundJobApiClient.dismissBackgroundJob",
)(function* ({ id }: BackgroundJobCommandArgs) {
  const client = yield* AppApiClient;

  yield* client.backgroundJob.dismissBackgroundJob({
    params: { jobId: id },
  });
});
