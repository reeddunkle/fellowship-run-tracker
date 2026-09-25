import * as E from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Queue from "effect/Queue";
import * as Ref from "effect/Ref";
import * as Stream from "effect/Stream";

import { makeLiveSplitGatewayClient } from "@frt/api/services/live-split-gateway/live-split-gateway-client.ts";
import { appendEOL } from "@frt/api/services/live-split-gateway/live-split-gateway-command.ts";
import {
  LiveSplitGatewayTransportFactory,
  type LiveSplitGatewayTransportFactoryShape,
} from "@frt/api/services/live-split-gateway/live-split-gateway-transport-factory-service.ts";
import { type LiveSplitGatewayTransport } from "@frt/api/services/live-split-gateway/node-live-split-gateway-transport.ts";

export function makeLiveSplitGatewayTransportTestHarness() {
  return E.gen(function* () {
    const incomingChunks = yield* Queue.unbounded<string>();
    const writtenData = yield* Queue.unbounded<string>();
    const commandHistory = yield* Ref.make<ReadonlyArray<string>>([]);

    const transport: LiveSplitGatewayTransport = {
      chunks: Stream.fromQueue(incomingChunks),

      connected: E.void,

      write: (data) => {
        return E.gen(function* () {
          yield* Ref.update(commandHistory, (commands) => {
            return [...commands, data];
          });

          yield* Queue.offer(writtenData, data);
        });
      },
    };

    const transportFactoryLayer = Layer.succeed(
      LiveSplitGatewayTransportFactory,
      {
        open: () => {
          return E.succeed(transport);
        },
      } satisfies LiveSplitGatewayTransportFactoryShape,
    );

    const start = <A, Error>(effect: E.Effect<A, Error>) => {
      return E.gen(function* () {
        const fiber = yield* effect.pipe(E.forkScoped);

        return {
          join: Fiber.join(fiber),
        };
      });
    };

    const takeCommand = () => {
      return Queue.take(writtenData);
    };

    const getCommands = () => {
      return Ref.get(commandHistory);
    };

    const sendResponse = (response: string) => {
      return Queue.offer(incomingChunks, appendEOL(response)).pipe(E.asVoid);
    };

    const sendChunk = (chunk: string) => {
      return Queue.offer(incomingChunks, chunk).pipe(E.asVoid);
    };

    return {
      getCommands,
      sendChunk,
      sendResponse,
      start,
      takeCommand,
      transport,
      transportFactoryLayer,
    };
  });
}

export function makeLiveSplitGatewayClientTestHarness() {
  return E.gen(function* () {
    const transportHarness = yield* makeLiveSplitGatewayTransportTestHarness();

    const client = yield* makeLiveSplitGatewayClient({
      transport: transportHarness.transport,
    });

    const awaitUnavailability = client.unavailability.pipe(
      Stream.runHead,
      E.map(Option.getOrThrow),
    );

    return {
      ...transportHarness,
      awaitUnavailability,
      client,
    };
  });
}
