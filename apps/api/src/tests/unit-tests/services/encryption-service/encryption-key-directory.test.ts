import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import { describe, expect, test } from "vitest";

import { appPaths } from "@frt/api/helpers/app-paths.ts";
import { EncryptionKeyDirectory } from "@frt/api/services/encryption/encryption-key-directory.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";

const readEncryptionKeyDirectory = E.gen(function* () {
  return yield* EncryptionKeyDirectory;
});

describe("EncryptionKeyDirectory", () => {
  test("defaults to the app data encryption key directory", async () => {
    const directory = await runTest(readEncryptionKeyDirectory);

    expect(directory).toBe(appPaths.encryptionKey);
  });

  test("uses a provided directory instead of the default", async () => {
    const directory = await runTest(
      readEncryptionKeyDirectory.pipe(
        E.provide(Layer.succeed(EncryptionKeyDirectory, "custom-directory")),
      ),
    );

    expect(directory).toBe("custom-directory");
  });
});
