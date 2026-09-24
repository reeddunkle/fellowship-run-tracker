import * as Cause from "effect/Cause";
import * as Deferred from "effect/Deferred";
import * as E from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Queue from "effect/Queue";
import * as Ref from "effect/Ref";
import * as Result from "effect/Result";
import * as Stream from "effect/Stream";
import type * as Socket from "effect/unstable/socket/Socket";

import {
  LiveSplitClientInvalidResponseError,
  LiveSplitClientUnavailableError,
} from "@frt/api/errors/live-split-client-error.ts";

import {
  formatLiveSplitCommand,
  LIVE_SPLIT_EOL,
  type LiveSplitCommandInput,
  LiveSplitRequestCommand,
  type LiveSplitRequestCommandInput,
  LiveSplitSendCommand,
  type LiveSplitSendCommandInput,
} from "./live-split-command.ts";
import { type LiveSplitTransport } from "./node-live-split-transport.ts";

const RESPONSE_TIMEOUT = "5 seconds";

export type LiveSplitRequestError =
  | Cause.TimeoutError
  | LiveSplitClientUnavailableError
  | Socket.SocketError;

export type LiveSplitClientUnavailabilityCause =
  Cause.Cause<LiveSplitRequestError>;

type PendingLiveSplitRequest = {
  readonly command: LiveSplitRequestCommandInput;
  readonly responseDeferred: Deferred.Deferred<string, LiveSplitRequestError>;
};

type LiveSplitResponseQueueItem = Result.Result<
  string,
  LiveSplitClientUnavailabilityCause
>;

export type LiveSplitClientService = {
  readonly getCurrentTime: () => E.Effect<string, LiveSplitRequestError>;

  readonly getSplitIndex: () => E.Effect<
    number,
    LiveSplitClientInvalidResponseError | LiveSplitRequestError
  >;

  readonly getTimerPhase: () => E.Effect<string, LiveSplitRequestError>;

  readonly pause: () => E.Effect<void, Socket.SocketError>;

  readonly reset: () => E.Effect<void, Socket.SocketError>;

  readonly setComparison: (
    comparisonName: string,
  ) => E.Effect<void, Socket.SocketError>;

  readonly setCurrentSplitName: (
    splitName: string,
  ) => E.Effect<void, Socket.SocketError>;

  readonly split: () => E.Effect<void, Socket.SocketError>;

  readonly startTimer: () => E.Effect<void, Socket.SocketError>;

  readonly switchSplits: (
    filePath: string,
  ) => E.Effect<
    void,
    LiveSplitClientInvalidResponseError | LiveSplitRequestError
  >;

  readonly unavailability: Stream.Stream<LiveSplitClientUnavailabilityCause>;
};

export function makeLiveSplitClient({
  transport,
}: {
  readonly transport: LiveSplitTransport;
}) {
  return E.gen(function* () {
    const responseQueue = yield* Queue.unbounded<LiveSplitResponseQueueItem>();

    const requestQueue = yield* Queue.unbounded<PendingLiveSplitRequest>();

    const responseChannelFailure = yield* Ref.make<
      LiveSplitClientUnavailabilityCause | undefined
    >(undefined);

    const unavailabilityDeferred =
      yield* Deferred.make<LiveSplitClientUnavailabilityCause>();

    const unavailability: LiveSplitClientService["unavailability"] =
      unavailabilityDeferred.pipe(Deferred.await, Stream.fromEffect);

    const markUnavailable = (
      cause: LiveSplitClientUnavailabilityCause,
    ): E.Effect<void> => {
      return E.gen(function* () {
        const existingFailure = yield* Ref.get(responseChannelFailure);

        if (existingFailure !== undefined) {
          return;
        }

        yield* Ref.set(responseChannelFailure, cause);
        yield* Deferred.succeed(unavailabilityDeferred, cause);
      });
    };

    const responseStream = transport.chunks.pipe(
      Stream.mapAccumEffect(
        () => "",
        (responseBuffer, socketChunk) => {
          const responseParts = `${responseBuffer}${socketChunk}`.split(
            LIVE_SPLIT_EOL,
          );

          const remainingBuffer = responseParts.pop() ?? "";

          return E.succeed([remainingBuffer, responseParts] as const);
        },
      ),
    );

    yield* E.gen(function* () {
      const exit = yield* E.exit(
        responseStream.pipe(
          Stream.runForEach((response) => {
            return Queue.offer(responseQueue, Result.succeed(response));
          }),
        ),
      );

      let failureCause: LiveSplitClientUnavailabilityCause;

      if (Exit.isFailure(exit)) {
        failureCause = exit.cause;
      } else {
        failureCause = Cause.fail(
          new LiveSplitClientUnavailableError({
            reason: "ResponseStreamEnded",
          }),
        );
      }

      yield* markUnavailable(failureCause);

      yield* Queue.offer(responseQueue, Result.fail(failureCause));
    }).pipe(E.forkScoped);

    const writeCommand = E.fn("livesplit.send")(function* (
      input: LiveSplitCommandInput,
    ): E.fn.Return<void, Socket.SocketError> {
      yield* E.annotateCurrentSpan("livesplit.command", input.command);

      yield* transport.write(formatLiveSplitCommand(input));
    });

    const send = (
      input: LiveSplitSendCommandInput,
    ): E.Effect<void, Socket.SocketError> => {
      return writeCommand(input).pipe(E.tapCause(markUnavailable));
    };

    yield* Stream.fromQueue(requestQueue).pipe(
      Stream.runForEach(({ command, responseDeferred }) => {
        return E.gen(function* () {
          const requestEffect = E.gen(function* () {
            const existingFailure = yield* Ref.get(responseChannelFailure);

            if (existingFailure !== undefined) {
              return yield* E.failCause(existingFailure);
            }

            yield* writeCommand(command).pipe(E.tapCause(markUnavailable));

            const responseResult = yield* Queue.take(responseQueue).pipe(
              E.timeout(RESPONSE_TIMEOUT),
              E.tapError(() => {
                const failureCause = Cause.fail(
                  new LiveSplitClientUnavailableError({
                    reason: "ResponseStreamDesynchronized",
                  }),
                );

                return markUnavailable(failureCause);
              }),
            );

            return yield* Result.match(responseResult, {
              onFailure: (cause) => {
                return E.failCause(cause);
              },
              onSuccess: (response) => {
                return E.succeed(response);
              },
            });
          });

          const requestExit = yield* E.exit(requestEffect);

          yield* Exit.match(requestExit, {
            onFailure: (cause) => {
              return Deferred.failCause(responseDeferred, cause);
            },
            onSuccess: (response) => {
              return Deferred.succeed(responseDeferred, response);
            },
          });
        });
      }),
      E.forkScoped,
    );

    const request = E.fn("livesplit.request")(function* (
      command: LiveSplitRequestCommandInput,
    ): E.fn.Return<string, LiveSplitRequestError> {
      yield* E.annotateCurrentSpan("livesplit.command", command.command);

      const responseDeferred = yield* Deferred.make<
        string,
        LiveSplitRequestError
      >();

      yield* Queue.offer(requestQueue, {
        command,
        responseDeferred,
      });

      return yield* Deferred.await(responseDeferred);
    });

    const parseSplitIndex = (
      response: string,
    ): E.Effect<number, LiveSplitClientInvalidResponseError> => {
      const splitIndex = Number.parseInt(response, 10);

      if (Number.isNaN(splitIndex)) {
        return E.fail(
          new LiveSplitClientInvalidResponseError({
            command: LiveSplitRequestCommand.getSplitIndex,
            response,
          }),
        );
      }

      return E.succeed(splitIndex);
    };

    const requireSuccessfulBooleanResponse = ({
      command,
      response,
    }: {
      readonly command: LiveSplitRequestCommand;
      readonly response: string;
    }): E.Effect<void, LiveSplitClientInvalidResponseError> => {
      if (response.trim().toLowerCase() === "true") {
        return E.void;
      }

      return E.fail(
        new LiveSplitClientInvalidResponseError({
          command,
          response,
        }),
      );
    };

    return {
      getCurrentTime: () => {
        return request({
          command: LiveSplitRequestCommand.getCurrentTime,
        });
      },

      getSplitIndex: () => {
        return request({
          command: LiveSplitRequestCommand.getSplitIndex,
        }).pipe(E.flatMap(parseSplitIndex));
      },

      getTimerPhase: () => {
        return request({
          command: LiveSplitRequestCommand.getTimerPhase,
        });
      },

      pause: () => {
        return send({
          command: LiveSplitSendCommand.pause,
        });
      },

      reset: () => {
        return send({
          command: LiveSplitSendCommand.reset,
        });
      },

      setComparison: (comparisonName) => {
        return send({
          argument: comparisonName,
          command: LiveSplitSendCommand.setComparison,
        });
      },

      setCurrentSplitName: (splitName) => {
        return send({
          argument: splitName,
          command: LiveSplitSendCommand.setCurrentSplitName,
        });
      },

      split: () => {
        return send({
          command: LiveSplitSendCommand.split,
        });
      },

      startTimer: () => {
        return send({
          command: LiveSplitSendCommand.startTimer,
        });
      },

      switchSplits: (filePath) => {
        const command = {
          argument: filePath,
          command: LiveSplitRequestCommand.switchSplits,
        } satisfies LiveSplitRequestCommandInput;

        return request(command).pipe(
          E.flatMap((response) => {
            return requireSuccessfulBooleanResponse({
              command: command.command,
              response,
            });
          }),
        );
      },

      unavailability,
    } satisfies LiveSplitClientService;
  });
}
