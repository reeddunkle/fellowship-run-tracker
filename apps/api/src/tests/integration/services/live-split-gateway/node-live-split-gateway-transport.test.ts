import * as Net from "node:net";

import * as E from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Stream from "effect/Stream";
import { describe, expect, test } from "vitest";

import { makeNodeLiveSplitGatewayTransport } from "@frt/api/services/live-split-gateway/node-live-split-gateway-transport.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";

const MOCK_TIMEOUT = "1 second";

const HOST = "127.0.0.1";

function makeTcpServer(onConnection: (socket: Net.Socket) => void) {
  return E.acquireRelease(
    E.callback<Net.Server>((resume) => {
      const server = Net.createServer(onConnection);

      server.listen(0, HOST, () => {
        resume(E.succeed(server));
      });
    }),
    (server) => {
      return E.callback<void>((resume) => {
        server.close(() => {
          resume(E.void);
        });
      });
    },
  );
}

function getPort(server: Net.Server): number {
  const address = server.address();

  if (address === null || typeof address === "string") {
    throw new Error("Expected the TCP test server to listen on a port.");
  }

  return address.port;
}

function collectChunks(
  onConnection: (socket: Net.Socket) => void,
): E.Effect<Exit.Exit<ReadonlyArray<string>, unknown>> {
  return E.scoped(
    E.gen(function* () {
      const server = yield* makeTcpServer(onConnection);

      const transport = yield* makeNodeLiveSplitGatewayTransport({
        host: HOST,
        port: getPort(server),
      });

      return yield* transport.chunks.pipe(
        Stream.runCollect,
        E.map((chunks) => {
          return Array.from(chunks);
        }),
        E.timeout(MOCK_TIMEOUT),
        E.exit,
      );
    }),
  ).pipe(E.orDie);
}

describe("Node LiveSplit gateway transport", () => {
  test("ends the chunk stream when LiveSplit closes the connection normally", async () => {
    const program = E.gen(function* () {
      const exit = yield* collectChunks((socket) => {
        socket.end("00:01:23\r\n");
      });

      expect(exit).toEqual(Exit.succeed(["00:01:23\r\n"]));
    });

    await runTest(program);
  });

  test("fails the chunk stream when the connection is reset", async () => {
    const program = E.gen(function* () {
      const exit = yield* collectChunks((socket) => {
        socket.resetAndDestroy();
      });

      expect(Exit.isFailure(exit)).toBe(true);
    });

    await runTest(program);
  });
});
