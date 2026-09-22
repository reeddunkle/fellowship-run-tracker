import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import type * as PlatformError from "effect/PlatformError";
import type * as Scope from "effect/Scope";

import { NodePlatformLayer } from "@frt/api/layers/node-platform-layer.ts";
import { EncryptionKeyStorage } from "@frt/api/services/encryption/encryption-key-storage-service.ts";
import {
  Encryption,
  type EncryptionShape,
} from "@frt/api/services/encryption/encryption-service.ts";

export type EncryptionHarness = {
  readonly encryption: EncryptionShape;
  readonly encryptionKeyDirectory: string;
};

export function makeEncryptionHarness(): E.Effect<
  EncryptionHarness,
  PlatformError.PlatformError,
  Scope.Scope
> {
  return E.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;

    const encryptionKeyDirectory = yield* fileSystem.makeTempDirectoryScoped();

    const encryptionKeyStorageLive = EncryptionKeyStorage.layerWith({
      encryptionKeyDirectory,
    });

    const EncryptionTestLive = Encryption.layerNoDeps.pipe(
      Layer.provide(encryptionKeyStorageLive),
    );

    const encryption = yield* Encryption.pipe(E.provide(EncryptionTestLive));

    return {
      encryption,
      encryptionKeyDirectory,
    } satisfies EncryptionHarness;
  }).pipe(E.provide(NodePlatformLayer));
}
