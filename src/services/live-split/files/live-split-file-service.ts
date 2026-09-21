import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import type * as PlatformError from "effect/PlatformError";

import { type FellowshipMilestoneConfiguration } from "@/services/fellowship/configurations/configuration-types.ts";

import { createLSSFromConfiguration } from "./lss/create-lss-from-configuration.ts";

type CreateLSSOptions = {
  readonly configuration: FellowshipMilestoneConfiguration;
  readonly dungeonName: string;
};

type WriteLSSFileOptions = {
  readonly configuration: FellowshipMilestoneConfiguration;
  readonly dungeonName: string;
  readonly filePath: string;
};

export type LiveSplitFileService = {
  readonly createLSS: (options: CreateLSSOptions) => string;

  readonly writeLSSFile: (
    options: WriteLSSFileOptions,
  ) => E.Effect<
    void,
    PlatformError.PlatformError,
    FileSystem.FileSystem | Path.Path
  >;
};

function makeLiveSplitFile(): LiveSplitFileService {
  const createLSS = ({
    configuration,
    dungeonName,
  }: CreateLSSOptions): string => {
    return createLSSFromConfiguration({
      configuration,
      dungeonName,
    });
  };

  const writeLSSFile = ({
    configuration,
    dungeonName,
    filePath,
  }: WriteLSSFileOptions) => {
    return E.gen(function* () {
      const fileSystem = yield* FileSystem.FileSystem;
      const path = yield* Path.Path;

      const contents = createLSS({
        configuration,
        dungeonName,
      });

      yield* fileSystem.makeDirectory(path.dirname(filePath), {
        recursive: true,
      });

      yield* fileSystem.writeFileString(filePath, contents);
    });
  };

  return {
    createLSS,
    writeLSSFile,
  };
}

export class LiveSplitFile extends Context.Service<
  LiveSplitFile,
  LiveSplitFileService
>()(
  "fellowship-run-tracker/services/live-split/files/live-split-file-service/LiveSplitFile",
) {
  static readonly layer = Layer.succeed(this, makeLiveSplitFile());
}
