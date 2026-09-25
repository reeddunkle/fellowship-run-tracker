import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Match from "effect/Match";
import type * as PlatformError from "effect/PlatformError";
import * as Stream from "effect/Stream";

import { AppSettingsStore } from "@frt/api/services/app-settings-store/app-settings-store-service.ts";
import {
  FileMonitor,
  type FileMonitorError,
} from "@frt/api/services/filesystem/file-monitor-service.ts";
import { FileMonitorSource } from "@frt/api/services/filesystem/file-monitor-source-service.ts";
import { type FellowshipEvent } from "@frt/shared/fellowship/validation/fellowship-event-schema.ts";

import { parseFellowshipEventStream } from "./parsing/parse-fellowship-event-stream.ts";

const FELLOWSHIP_LOG_FILE_EXTENSION = ".txt";

const isFellowshipLogFile = (fileName: string): boolean => {
  return fileName.toLowerCase().endsWith(FELLOWSHIP_LOG_FILE_EXTENSION);
};

export type FellowshipLiveStatus =
  | {
      readonly _tag: "WaitingForLogFile";
    }
  | {
      readonly _tag: "MonitoringLogFile";
      readonly filePath: string;
    };

export type FellowshipService = {
  readonly liveEvents: () => Stream.Stream<FellowshipEvent, FileMonitorError>;

  readonly liveStatus: () => Stream.Stream<
    FellowshipLiveStatus,
    PlatformError.PlatformError
  >;

  readonly readEvents: (
    filePath: string,
  ) => E.Effect<ReadonlyArray<FellowshipEvent>, FileMonitorError>;

  readonly streamEvents: (
    filePath: string,
  ) => Stream.Stream<FellowshipEvent, FileMonitorError>;
};

const makeFellowship = E.gen(function* () {
  const appSettingsStore = yield* AppSettingsStore;
  const fileMonitor = yield* FileMonitor;
  const fileMonitorSource = yield* FileMonitorSource;

  const streamEvents: FellowshipService["streamEvents"] = (
    filePath: string,
  ) => {
    return parseFellowshipEventStream(
      fileMonitor.streamLines({
        filePath,
      }),
    );
  };

  const readEvents: FellowshipService["readEvents"] = (filePath: string) => {
    return streamEvents(filePath).pipe(Stream.runCollect);
  };

  const liveEvents: FellowshipService["liveEvents"] = () => {
    return Stream.unwrap(
      E.gen(function* () {
        const settings = yield* appSettingsStore.get();

        return fileMonitor
          .streamLatestFileLines({
            directoryPath: settings.fellowshipLogDirectory,
            matches: isFellowshipLogFile,
            startFrom: "end",
          })
          .pipe(parseFellowshipEventStream);
      }),
    );
  };

  const liveStatus: FellowshipService["liveStatus"] = () => {
    return Stream.unwrap(
      E.gen(function* () {
        const settings = yield* appSettingsStore.get();

        return fileMonitorSource
          .streamStatus({
            directoryPath: settings.fellowshipLogDirectory,
            matches: isFellowshipLogFile,
          })
          .pipe(
            Stream.map((status) => {
              return Match.value(status).pipe(
                Match.tag("WAITING_FOR_FILE", () => {
                  return {
                    _tag: "WaitingForLogFile",
                  } satisfies FellowshipLiveStatus;
                }),
                Match.tag("MONITORING", (monitoringStatus) => {
                  return {
                    _tag: "MonitoringLogFile",
                    filePath: monitoringStatus.filePath,
                  } satisfies FellowshipLiveStatus;
                }),
                Match.exhaustive,
              );
            }),
          );
      }),
    );
  };

  return {
    liveEvents,
    liveStatus,
    readEvents,
    streamEvents,
  } satisfies FellowshipService;
});

export class Fellowship extends Context.Service<
  Fellowship,
  FellowshipService
>()("@frt/api/services/fellowship/fellowship-service/Fellowship") {
  static readonly layerNoDeps = Layer.effect(this, makeFellowship);

  static readonly layer = this.layerNoDeps.pipe(
    Layer.provide(Layer.mergeAll(FileMonitor.layer, FileMonitorSource.layer)),
    Layer.provide(AppSettingsStore.layer),
  );
}
