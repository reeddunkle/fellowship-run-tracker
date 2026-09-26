import * as Cause from "effect/Cause";
import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import * as Layer from "effect/Layer";
import * as Path from "effect/Path";
import * as Semaphore from "effect/Semaphore";
import * as HttpClient from "effect/unstable/http/HttpClient";
import type * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import * as HttpClientResponse from "effect/unstable/http/HttpClientResponse";

import { redactUserPaths } from "@frt/api/logging/redact-user-paths.ts";
import { makeRepeatedFailureLogger } from "@frt/shared/util/make-repeated-failure-logger.ts";

type FileOtlpHttpClientOptions = {
  readonly filePath: string;
  readonly maxBytes: number;
};

const textDecoder = new TextDecoder();

const textEncoder = new TextEncoder();

function getRequestBodyText(request: HttpClientRequest.HttpClientRequest) {
  return request.body._tag === "Uint8Array"
    ? redactUserPaths(textDecoder.decode(request.body.body))
    : undefined;
}

export const makeFileOtlpHttpClient = E.fn(function* ({
  filePath,
  maxBytes,
}: FileOtlpHttpClientOptions) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const writeLock = yield* Semaphore.make(1);
  const fileName = path.basename(filePath);

  const writeFailures = yield* makeRepeatedFailureLogger({
    level: "Warn",
    message: "Failed to write to the trace file.",
  });

  let writtenBytes = 0;
  let hasReachedLimit = false;

  yield* fileSystem.makeDirectory(path.dirname(filePath), {
    recursive: true,
  });

  const appendLine = (text: string) => {
    return writeLock.withPermit(
      E.gen(function* () {
        const line = `${text}\n`;
        const lineBytes = textEncoder.encode(line).byteLength;

        if (writtenBytes + lineBytes > maxBytes) {
          if (!hasReachedLimit) {
            hasReachedLimit = true;

            yield* E.logWarning(
              "The trace file reached its size limit; later spans are not recorded.",
              { fileName, maxBytes },
            );
          }

          return;
        }

        yield* fileSystem.writeFileString(filePath, line, { flag: "a" });

        writtenBytes += lineBytes;
      }),
    );
  };

  return HttpClient.make((request) => {
    const text = getRequestBodyText(request);

    return (text === undefined ? E.void : appendLine(text)).pipe(
      E.andThen(writeFailures.onSuccess),
      E.catch((error) => {
        return writeFailures
          .onFailure(Cause.fail(error), { fileName })
          .pipe(E.asVoid);
      }),
      E.as(
        HttpClientResponse.fromWeb(
          request,
          new Response(null, { status: 200 }),
        ),
      ),
    );
  });
});

export function makeFileOtlpHttpClientLayer(
  options: FileOtlpHttpClientOptions,
) {
  return Layer.effect(HttpClient.HttpClient, makeFileOtlpHttpClient(options));
}
