import * as Context from "effect/Context";
import type * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as Stream from "effect/Stream";

import { FellowshipLogsDungeonRunImporter } from "@frt/api/application/fellowship-logs-dungeon-run-importer/fellowship-logs-dungeon-run-importer-service.ts";
import {
  type BackgroundJobError,
  type BackgroundJobNotFoundError,
} from "@frt/api/errors/background-job-error.ts";
import { NodePlatformLayer } from "@frt/api/layers/node-platform-layer.ts";
import { type BackgroundJob } from "@frt/api/services/background-job/background-job-schema.ts";
import { makeBackgroundJobService } from "@frt/api/services/background-job/make-background-job-service.ts";
import { DungeonRunRepository } from "@frt/api/services/dungeon-run-repository/dungeon-run-repository-service.ts";
import { BackgroundJobDAO } from "@frt/db/daos/background-job/background-job-dao.ts";
import { type BackgroundJobModel } from "@frt/db/models/background-job-model.ts";
import { type BackgroundJobId } from "@frt/shared/validation/background-job/background-job-id-schema.ts";

export type VisibleBackgroundJob = {
  readonly job: BackgroundJobModel;
  readonly progress: number | null;
};

type OfferBackgroundJobResult = {
  readonly job: BackgroundJobModel;
  readonly wasAlreadyQueued: boolean;
};

type BackgroundJobIdOptions = {
  readonly id: BackgroundJobId;
};

type BackgroundJobCommandError =
  | BackgroundJobError
  | BackgroundJobNotFoundError;

export type BackgroundJobServiceShape = {
  readonly cancel: (
    options: BackgroundJobIdOptions,
  ) => E.Effect<void, BackgroundJobCommandError>;

  readonly changes: Stream.Stream<number>;

  readonly dismiss: (
    options: BackgroundJobIdOptions,
  ) => E.Effect<void, BackgroundJobCommandError>;

  readonly listVisible: () => E.Effect<
    ReadonlyArray<VisibleBackgroundJob>,
    BackgroundJobError
  >;

  readonly offer: (
    job: BackgroundJob,
  ) => E.Effect<OfferBackgroundJobResult, BackgroundJobError>;

  readonly retry: (
    options: BackgroundJobIdOptions,
  ) => E.Effect<BackgroundJobModel, BackgroundJobCommandError>;

  readonly revision: E.Effect<number>;

  readonly sessionId: string;
};

export class BackgroundJobService extends Context.Service<
  BackgroundJobService,
  BackgroundJobServiceShape
>()(
  "@frt/api/services/background-job/background-job-service/BackgroundJobService",
) {
  static readonly layerNoDeps = Layer.effect(this, makeBackgroundJobService);

  static readonly layer = this.layerNoDeps.pipe(
    Layer.provide(BackgroundJobDAO.layer),
    Layer.provide(DungeonRunRepository.layer),
    Layer.provide(FellowshipLogsDungeonRunImporter.layer),
    Layer.provide(NodePlatformLayer),
  );
}
