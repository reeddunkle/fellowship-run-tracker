import * as Context from "effect/Context";
import type * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as KeyValueStore from "effect/unstable/persistence/KeyValueStore";
import * as PersistedQueue from "effect/unstable/persistence/PersistedQueue";

import { type BackgroundJobsError } from "@frt/api/errors/background-jobs-error.ts";
import { NodePlatformLayer } from "@frt/api/layers/node-platform-layer.ts";
import { type BackgroundJob } from "@frt/api/services/background-jobs/background-job-schema.ts";
import { makeBackgroundJobs } from "@frt/api/services/background-jobs/make-background-jobs-service.ts";
import { DungeonRunRepository } from "@frt/api/services/dungeon-run-repository/dungeon-run-repository-service.ts";
import { KeyValueStorePersistedQueueStoreLayer } from "@frt/api/services/persistence/key-value-store-persisted-queue-store.ts";

export type BackgroundJobsShape = {
  readonly offer: (job: BackgroundJob) => E.Effect<void, BackgroundJobsError>;
};

export class BackgroundJobs extends Context.Service<
  BackgroundJobs,
  BackgroundJobsShape
>()(
  "@frt/api/services/background-jobs/background-jobs-service/BackgroundJobs",
) {
  static readonly layerNoDeps = Layer.effect(this, makeBackgroundJobs);

  static readonly layerWith = (options: {
    readonly backgroundJobsDirectory: string;
  }) => {
    return this.layerNoDeps.pipe(
      Layer.provide(DungeonRunRepository.layer),
      Layer.provide(PersistedQueue.layer),
      Layer.provide(KeyValueStorePersistedQueueStoreLayer),
      Layer.provide(
        KeyValueStore.layerFileSystem(options.backgroundJobsDirectory),
      ),
      Layer.provide(NodePlatformLayer),
    );
  };
}
