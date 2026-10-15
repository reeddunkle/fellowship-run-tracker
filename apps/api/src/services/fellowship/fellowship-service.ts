import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as PlatformError from "effect/PlatformError";
import * as Stream from "effect/Stream";

import { AppSettingsStore } from "@frt/api/services/app-settings-store/app-settings-store-service.ts";
import { FileMonitor } from "@frt/api/services/filesystem/file-monitor-service.ts";
import { type FellowshipEvent } from "@frt/shared/fellowship/validation/fellowship-event-schema.ts";

import {
  type FellowshipLiveLogItem,
  parseFellowshipLiveLog,
} from "./fellowship-live-log.ts";
import { getFellowshipLogStartedAt } from "./parsing/get-fellowship-log-started-at.ts";
import { parseFellowshipEventStream } from "./parsing/parse-fellowship-event-stream.ts";

const FELLOWSHIP_LOG_FILE_EXTENSION = ".txt";

const isFellowshipLogFile = (fileName: string): boolean => {
  return fileName.toLowerCase().endsWith(FELLOWSHIP_LOG_FILE_EXTENSION);
};

export type FellowshipShape = {
  readonly liveLog: () => Stream.Stream<
    FellowshipLiveLogItem,
    PlatformError.PlatformError
  >;

  readonly streamEvents: (
    filePath: string,
  ) => Stream.Stream<FellowshipEvent, PlatformError.PlatformError>;
};

const makeFellowship = E.gen(function* () {
  const appSettingsStore = yield* AppSettingsStore;
  const fileMonitor = yield* FileMonitor;

  const streamEvents: FellowshipShape["streamEvents"] = (filePath: string) => {
    return parseFellowshipEventStream(
      fileMonitor.streamLines({
        filePath,
      }),
    );
  };

  const liveLog: FellowshipShape["liveLog"] = () => {
    return Stream.unwrap(
      E.gen(function* () {
        const settings = yield* appSettingsStore.get();

        return fileMonitor
          .streamLatestFile({
            directoryPath: settings.fellowshipLogDirectory,
            getContentStartedAt: getFellowshipLogStartedAt,
            matches: isFellowshipLogFile,
            startFrom: "end",
          })
          .pipe(parseFellowshipLiveLog);
      }),
    );
  };

  return {
    liveLog,
    streamEvents,
  } satisfies FellowshipShape;
});

export class Fellowship extends Context.Service<Fellowship, FellowshipShape>()(
  "@frt/api/services/fellowship/fellowship-service/Fellowship",
) {
  static readonly layerNoDeps = Layer.effect(this, makeFellowship);

  static readonly layer = this.layerNoDeps.pipe(
    Layer.provide(FileMonitor.layer),
    Layer.provide(AppSettingsStore.layer),
  );
}
