import * as E from "effect/Effect";
import * as Fiber from "effect/Fiber";
import * as Option from "effect/Option";
import * as Queue from "effect/Queue";
import * as Ref from "effect/Ref";
import * as Stream from "effect/Stream";

import { makeLiveSplitClient } from "@/services/live-split/core/live-split-client-service.ts";
import { appendEOL } from "@/services/live-split/core/live-split-command.ts";
import { type LiveSplitTransport } from "@/services/live-split/core/node-live-split-transport.ts";

export function makeLiveSplitTestHarness() {
  return E.gen(function* () {
    const incomingChunks = yield* Queue.unbounded<string>();
    const writtenData = yield* Queue.unbounded<string>();
    const commandHistory = yield* Ref.make<ReadonlyArray<string>>([]);

    const transport: LiveSplitTransport = {
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

    const client = yield* makeLiveSplitClient({
      transport,
    });

    const start = <A, Error>(effect: E.Effect<A, Error>) => {
      return E.gen(function* () {
        const fiber = yield* effect.pipe(E.forkScoped);

        return {
          join: Fiber.join(fiber),
        };
      });
    };

    const awaitUnavailability = client.unavailability.pipe(
      Stream.runHead,
      E.map(Option.getOrThrow),
    );

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
      awaitUnavailability,
      client,
      getCommands,
      sendChunk,
      sendResponse,
      start,
      takeCommand,
    };
  });
}
