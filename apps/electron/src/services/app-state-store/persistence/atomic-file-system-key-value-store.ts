import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as KeyValueStore from "effect/persistence/KeyValueStore";
import * as Schedule from "effect/Schedule";

const TEMPORARY_KEY_SUFFIX = ".tmp";

const RENAME_RETRY_COUNT = 3;

const RENAME_RETRY_DELAY = "20 millis";

function makeAtomicFileSystemKeyValueStore(directory: string) {
  return E.gen(function* () {
    const fileStore = yield* KeyValueStore.KeyValueStore;
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    const getFilePath = (key: string) => {
      return path.join(directory, encodeURIComponent(key));
    };

    const set = (key: string, value: string | Uint8Array) => {
      const temporaryKey = `${key}${TEMPORARY_KEY_SUFFIX}`;

      return fileStore.set(temporaryKey, value).pipe(
        E.andThen(
          fileSystem.rename(getFilePath(temporaryKey), getFilePath(key)).pipe(
            E.retry({
              schedule: Schedule.spaced(RENAME_RETRY_DELAY),
              times: RENAME_RETRY_COUNT,
            }),
            E.mapError((cause) => {
              return new KeyValueStore.KeyValueStoreError({
                cause,
                key,
                message: `Unable to set item with key ${key}`,
                method: "set",
              });
            }),
          ),
        ),
      );
    };

    return KeyValueStore.make({
      clear: fileStore.clear,
      get: fileStore.get,
      getUint8Array: fileStore.getUint8Array,
      remove: fileStore.remove,
      set,
      size: fileStore.size,
    });
  });
}

export function layerAtomicFileSystem(directory: string) {
  return Layer.effect(
    KeyValueStore.KeyValueStore,
    makeAtomicFileSystemKeyValueStore(directory),
  ).pipe(Layer.provide(KeyValueStore.layerFileSystem(directory)));
}
