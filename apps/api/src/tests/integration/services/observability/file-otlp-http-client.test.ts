import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import type * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import * as Layer from "effect/Layer";
import * as OtlpSerialization from "effect/observability/OtlpSerialization";
import * as OtlpTracer from "effect/observability/OtlpTracer";
import * as Path from "effect/Path";
import { describe, expect, test } from "vitest";

import { NodePlatformLayer } from "@frt/api/layers/node-platform-layer.ts";
import {
  makeFileOtlpHttpClient,
  makeFileOtlpHttpClientLayer,
} from "@frt/api/services/observability/file-otlp-http-client.ts";
import { FilterNoisySpansLayer } from "@frt/api/services/observability/filter-noisy-spans-layer.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";

function withTraceFilePath<A, Error>(
  program: (filePath: string) => E.Effect<A, Error, FileSystem.FileSystem>,
) {
  return E.gen(function* () {
    const fileSystem = yield* FileSystem.FileSystem;
    const path = yield* Path.Path;

    const directory = yield* fileSystem.makeTempDirectoryScoped();

    return yield* program(path.join(directory, "session.otlp.jsonl"));
  }).pipe(E.scoped, E.provide(NodePlatformLayer), runTest);
}

function postJson(client: HttpClient.HttpClient, body: unknown) {
  return client.execute(
    HttpClientRequest.post("file:///v1/traces").pipe(
      HttpClientRequest.bodyText(JSON.stringify(body), "application/json"),
    ),
  );
}

function readLines(filePath: string) {
  return FileSystem.FileSystem.use((fileSystem) => {
    return fileSystem.readFileString(filePath);
  }).pipe(
    E.map((contents) => {
      return contents.split("\n").filter((line) => {
        return line.length > 0;
      });
    }),
  );
}

describe("makeFileOtlpHttpClient", () => {
  test("appends each export as one JSON line and answers 200", async () => {
    const { lines, statuses } = await withTraceFilePath((filePath) => {
      return E.gen(function* () {
        const client = yield* makeFileOtlpHttpClient({
          filePath,
          maxBytes: 1024,
        });

        const first = yield* postJson(client, { batch: 1 });
        const second = yield* postJson(client, { batch: 2 });

        return {
          lines: yield* readLines(filePath),
          statuses: [first.status, second.status],
        };
      }).pipe(E.provide(NodePlatformLayer));
    });

    expect(statuses).toEqual([200, 200]);
    expect(lines.map((line): unknown => JSON.parse(line))).toEqual([
      { batch: 1 },
      { batch: 2 },
    ]);
  });

  test("stops writing at the size limit without failing the export", async () => {
    const { lines, status } = await withTraceFilePath((filePath) => {
      return E.gen(function* () {
        const client = yield* makeFileOtlpHttpClient({
          filePath,
          maxBytes: 20,
        });

        yield* postJson(client, { batch: 1 });
        const overLimit = yield* postJson(client, { batch: 2 });

        return {
          lines: yield* readLines(filePath),
          status: overLimit.status,
        };
      }).pipe(E.provide(NodePlatformLayer));
    });

    expect(status).toBe(200);
    expect(lines).toEqual(['{"batch":1}']);
  });

  test("records exported spans except the noisy ones", async () => {
    const contents = await withTraceFilePath((filePath) => {
      const FileTracingTestLayer = FilterNoisySpansLayer.pipe(
        Layer.provide(
          OtlpTracer.layer({
            resource: { serviceName: "test" },
            url: "file:///v1/traces",
          }),
        ),
        Layer.provide(OtlpSerialization.layerJson),
        Layer.provide(makeFileOtlpHttpClientLayer({ filePath, maxBytes: 1e6 })),
        Layer.provide(NodePlatformLayer),
      );

      return E.gen(function* () {
        yield* E.void.pipe(E.withSpan("kept-span"));
        yield* E.void.pipe(E.withSpan("sql.execute"));
      }).pipe(
        E.provide(FileTracingTestLayer),
        E.andThen(
          FileSystem.FileSystem.use((fileSystem) => {
            return fileSystem.readFileString(filePath);
          }),
        ),
      );
    });

    expect(contents).toContain('"name":"kept-span"');
    expect(contents).not.toContain("sql.execute");
  });
});
