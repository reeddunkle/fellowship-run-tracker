import * as Layer from "effect/Layer";

import { EncryptionKeyDirectory } from "@frt/api/services/encryption/encryption-key-directory.ts";
import { EncryptionKeyStorage } from "@frt/api/services/encryption/encryption-key-storage-service.ts";

export function makeEncryptionKeyStorageTestLayer(
  encryptionKeyDirectory: string,
) {
  return EncryptionKeyStorage.layer.pipe(
    Layer.provide(
      Layer.succeed(EncryptionKeyDirectory, encryptionKeyDirectory),
    ),
  );
}
