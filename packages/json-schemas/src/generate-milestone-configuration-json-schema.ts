import { NodeRuntime, NodeServices } from "@effect/platform-node";
import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";

import { FellowshipConfigurationFileSchema } from "@frt/shared/fellowship/validation/fellowship-configuration-file-schema.ts";

const SCHEMA_FILE_NAME = "milestone-configuration.json";

const program = E.gen(function* () {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  // [KEEP] Written into this package, which exports it (see package.json `exports`).
  const defaultOutputFilePath = path.join(
    import.meta.dirname,
    "../generated",
    SCHEMA_FILE_NAME,
  );

  const resolvedOutputPath = path.resolve(
    process.argv[2] ?? defaultOutputFilePath,
  );

  const standardSchema = Schema.toStandardJSONSchemaV1(
    FellowshipConfigurationFileSchema,
  );

  const jsonSchema = standardSchema["~standard"].jsonSchema.input({
    target: "draft-2020-12",
  });

  yield* fileSystem.makeDirectory(path.dirname(resolvedOutputPath), {
    recursive: true,
  });

  // [KEEP] Pretty-printing is intentional for this
  // @effect-diagnostics-next-line preferSchemaOverJson:off
  const contents = JSON.stringify(jsonSchema, null, 2);

  yield* fileSystem.writeFileString(resolvedOutputPath, `${contents}\n`);

  yield* E.logInfo("Generated milestone configuration JSON schema.", {
    outputFilePath: resolvedOutputPath,
  });
});

program.pipe(
  // @effect-diagnostics-next-line strictEffectProvide:off
  E.provide(NodeServices.layer),
  NodeRuntime.runMain,
);
