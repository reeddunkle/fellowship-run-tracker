import * as Context from "effect/Context";

import { appPaths } from "@frt/api/helpers/app-paths.ts";

export const EncryptionKeyDirectory = Context.Reference<string>(
  "@frt/api/services/encryption/encryption-key-directory/EncryptionKeyDirectory",
  {
    defaultValue: () => {
      return appPaths.encryptionKey;
    },
  },
);
