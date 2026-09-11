import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Path from "effect/Path";
import * as Schema from "effect/Schema";

import { FellowshipConfigurationFileSchema } from "@/services/fellowship/validation/fellowship-configuration-file-schema.ts";
import { NonEmptyStringSchema } from "@/validation/common-schemas.ts";

const GENERATED_SCHEMA_DIRECTORY = "./generated/schemas";
const SCHEMA_FILE_NAME = "milestone-configuration.json";

export const BuildMilestoneConfigurationJsonSchemaCommandInputSchema =
  Schema.Struct({
    outputFilePath: Schema.optionalKey(NonEmptyStringSchema),
  });

export type BuildMilestoneConfigurationJsonSchemaCommandInput =
  typeof BuildMilestoneConfigurationJsonSchemaCommandInputSchema.Type;

export const runBuildMilestoneConfigurationJsonSchemaCommand = E.fn(
  "dev-cli.build-milestone-configuration-json-schema",
)(function* ({
  outputFilePath,
}: BuildMilestoneConfigurationJsonSchemaCommandInput) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;

  const defaultOutputFilePath = path.join(
    GENERATED_SCHEMA_DIRECTORY,
    SCHEMA_FILE_NAME,
  );

  const resolvedOutputPath = path.resolve(
    outputFilePath ?? defaultOutputFilePath,
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

  // Pretty-printing is intentional for this generated human-readable artifact.
  // @effect-diagnostics-next-line preferSchemaOverJson:off
  const contents = JSON.stringify(jsonSchema, null, 2);

  yield* fileSystem.writeFileString(resolvedOutputPath, `${contents}\n`);

  yield* E.logInfo("Generated milestone configuration JSON schema.", {
    outputFilePath: resolvedOutputPath,
  });
});
