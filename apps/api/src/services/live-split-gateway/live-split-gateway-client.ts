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
  LiveSplitGatewayInvalidResponseError,
  LiveSplitGatewayUnavailableError,
} from "@frt/api/errors/live-split-gateway-error.ts";

import {
  formatLiveSplitGatewayCommand,
  LIVE_SPLIT_GATEWAY_EOL,
  type LiveSplitGatewayCommandInput,
  LiveSplitGatewayRequestCommand,
  type LiveSplitGatewayRequestCommandInput,
  LiveSplitGatewaySendCommand,
  type LiveSplitGatewaySendCommandInput,
} from "./live-split-gateway-command.ts";
import { type LiveSplitGatewayTransport } from "./node-live-split-gateway-transport.ts";

const RESPONSE_TIMEOUT = "5 seconds";

export type LiveSplitGatewayRequestError =
  | Cause.TimeoutError
  | LiveSplitGatewayUnavailableError
  | Socket.SocketError;

export type LiveSplitGatewayClientUnavailabilityCause =
  Cause.Cause<LiveSplitGatewayRequestError>;

type PendingLiveSplitGatewayRequest = {
  readonly command: LiveSplitGatewayRequestCommandInput;
  readonly responseDeferred: Deferred.Deferred<
    string,
    LiveSplitGatewayRequestError
  >;
};

type LiveSplitGatewayResponseQueueItem = Result.Result<
  string,
  LiveSplitGatewayClientUnavailabilityCause
>;

export type LiveSplitGatewayClient = {
  readonly getCurrentTime: () => E.Effect<string, LiveSplitGatewayRequestError>;

  readonly getSplitIndex: () => E.Effect<
    number,
    LiveSplitGatewayInvalidResponseError | LiveSplitGatewayRequestError
  >;

  readonly getTimerPhase: () => E.Effect<string, LiveSplitGatewayRequestError>;

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
    LiveSplitGatewayInvalidResponseError | LiveSplitGatewayRequestError
  >;

  readonly unavailability: Stream.Stream<LiveSplitGatewayClientUnavailabilityCause>;
};

export function makeLiveSplitGatewayClient({
  transport,
}: {
  readonly transport: LiveSplitGatewayTransport;
}) {
  return E.gen(function* () {
    const responseQueue =
      yield* Queue.unbounded<LiveSplitGatewayResponseQueueItem>();

    const requestQueue =
      yield* Queue.unbounded<PendingLiveSplitGatewayRequest>();

    const responseChannelFailure = yield* Ref.make<
      LiveSplitGatewayClientUnavailabilityCause | undefined
    >(undefined);

    const unavailabilityDeferred =
      yield* Deferred.make<LiveSplitGatewayClientUnavailabilityCause>();

    const unavailability: LiveSplitGatewayClient["unavailability"] =
      unavailabilityDeferred.pipe(Deferred.await, Stream.fromEffect);

    const markUnavailable = (
      cause: LiveSplitGatewayClientUnavailabilityCause,
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
            LIVE_SPLIT_GATEWAY_EOL,
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

      let failureCause: LiveSplitGatewayClientUnavailabilityCause;

      if (Exit.isFailure(exit)) {
        failureCause = exit.cause;
      } else {
        failureCause = Cause.fail(
          new LiveSplitGatewayUnavailableError({
            reason: "ResponseStreamEnded",
          }),
        );
      }

      yield* markUnavailable(failureCause);

      yield* Queue.offer(responseQueue, Result.fail(failureCause));
    }).pipe(E.forkScoped);

    const writeCommand = E.fn("LiveSplitGateway.send")(function* (
      input: LiveSplitGatewayCommandInput,
    ): E.fn.Return<void, Socket.SocketError> {
      yield* E.annotateCurrentSpan("livesplit.command", input.command);

      yield* transport.write(formatLiveSplitGatewayCommand(input));
    });

    const send = (
      input: LiveSplitGatewaySendCommandInput,
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
                  new LiveSplitGatewayUnavailableError({
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

    const request = E.fn("LiveSplitGateway.request")(function* (
      command: LiveSplitGatewayRequestCommandInput,
    ): E.fn.Return<string, LiveSplitGatewayRequestError> {
      yield* E.annotateCurrentSpan("livesplit.command", command.command);

      const responseDeferred = yield* Deferred.make<
        string,
        LiveSplitGatewayRequestError
      >();

      yield* Queue.offer(requestQueue, {
        command,
        responseDeferred,
      });

      return yield* Deferred.await(responseDeferred);
    });

    const parseSplitIndex = (
      response: string,
    ): E.Effect<number, LiveSplitGatewayInvalidResponseError> => {
      const splitIndex = Number.parseInt(response, 10);

      if (Number.isNaN(splitIndex)) {
        return E.fail(
          new LiveSplitGatewayInvalidResponseError({
            command: LiveSplitGatewayRequestCommand.getSplitIndex,
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
      readonly command: LiveSplitGatewayRequestCommand;
      readonly response: string;
    }): E.Effect<void, LiveSplitGatewayInvalidResponseError> => {
      if (response.trim().toLowerCase() === "true") {
        return E.void;
      }

      return E.fail(
        new LiveSplitGatewayInvalidResponseError({
          command,
          response,
        }),
      );
    };

    return {
      getCurrentTime: () => {
        return request({
          command: LiveSplitGatewayRequestCommand.getCurrentTime,
        });
      },

      getSplitIndex: () => {
        return request({
          command: LiveSplitGatewayRequestCommand.getSplitIndex,
        }).pipe(E.flatMap(parseSplitIndex));
      },

      getTimerPhase: () => {
        return request({
          command: LiveSplitGatewayRequestCommand.getTimerPhase,
        });
      },

      pause: () => {
        return send({
          command: LiveSplitGatewaySendCommand.pause,
        });
      },

      reset: () => {
        return send({
          command: LiveSplitGatewaySendCommand.reset,
        });
      },

      setComparison: (comparisonName) => {
        return send({
          argument: comparisonName,
          command: LiveSplitGatewaySendCommand.setComparison,
        });
      },

      setCurrentSplitName: (splitName) => {
        return send({
          argument: splitName,
          command: LiveSplitGatewaySendCommand.setCurrentSplitName,
        });
      },

      split: () => {
        return send({
          command: LiveSplitGatewaySendCommand.split,
        });
      },

      startTimer: () => {
        return send({
          command: LiveSplitGatewaySendCommand.startTimer,
        });
      },

      switchSplits: (filePath) => {
        const command = {
          argument: filePath,
          command: LiveSplitGatewayRequestCommand.switchSplits,
        } satisfies LiveSplitGatewayRequestCommandInput;

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
    } satisfies LiveSplitGatewayClient;
  });
}
