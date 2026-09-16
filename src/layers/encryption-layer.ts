import * as Layer from "effect/Layer";

import { NodePlatformLive } from "@/layers/node-platform-layer.ts";
import { makeEncryptionKeyStorageLive } from "@/services/encryption/encryption-key-storage-service.ts";
import { EncryptionLive } from "@/services/encryption/encryption-service.ts";

export type MakeEncryptionLayerOptions = {
  readonly encryptionKeyDirectory: string;
};

export function makeEncryptionLayer({
  encryptionKeyDirectory,
}: MakeEncryptionLayerOptions) {
  const EncryptionKeyStorageWithDependenciesLive = makeEncryptionKeyStorageLive(
    {
      encryptionKeyDirectory,
    },
  ).pipe(Layer.provide(NodePlatformLive));

  return EncryptionLive.pipe(
    Layer.provide(EncryptionKeyStorageWithDependenciesLive),
  );
}
