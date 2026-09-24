import * as A from "effect/Array";
import * as E from "effect/Effect";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";

import { FilePathSchema } from "@frt/shared/util/common-schemas.ts";

const GetDirectoryPathArgsSchema = Schema.Struct({
  filePath: FilePathSchema,
  relativePath: FilePathSchema,
});

export function getFileDirectoryPath(input: unknown) {
  return E.gen(function* () {
    const path = yield* Path.Path;

    const { filePath, relativePath } = yield* Schema.decodeUnknownEffect(
      GetDirectoryPathArgsSchema,
    )(input);

    const relativePathParts = relativePath.split("/");

    return A.reduce(
      relativePathParts,
      filePath,
      (currentDirectoryPath, _relativePathPart, index) => {
        return index === 0
          ? currentDirectoryPath
          : path.dirname(currentDirectoryPath);
      },
    );
  });
}
