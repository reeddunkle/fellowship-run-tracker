import * as Context from "effect/Context";

import { appPaths } from "@frt/api/helpers/app-paths.ts";

/**
 * Where the encryption key is stored. Defaults to the app data directory;
 * tests override it with `Layer.succeed(EncryptionKeyDirectory, directory)`.
 */
export const EncryptionKeyDirectory = Context.Reference<string>(
  "@frt/api/services/encryption/encryption-key-directory/EncryptionKeyDirectory",
  {
    defaultValue: () => {
      return appPaths.encryptionKey;
    },
  },
);
