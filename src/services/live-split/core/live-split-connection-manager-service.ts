import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as ScopedRef from "effect/ScopedRef";
import * as Stream from "effect/Stream";
import * as SubscriptionRef from "effect/SubscriptionRef";

import { LiveSplitConnectionError } from "@/errors/live-split-client-error.ts";
import { AppSettings } from "@/services/app-settings/app-settings-service.ts";
import {
  type LiveSplitClientService,
  makeLiveSplitClient,
} from "@/services/live-split/core/live-split-client-service.ts";
import { makeNodeLiveSplitTransport } from "@/services/live-split/core/node-live-split-transport.ts";

export type LiveSplitConnectionStatus =
  | {
      readonly _tag: "Disconnected";
    }
  | {
      readonly _tag: "Connected";
    };

export type LiveSplitConnectionManagerService = {
  readonly client: E.Effect<Option.Option<LiveSplitClientService>>;

  readonly connect: () => E.Effect<void, LiveSplitConnectionError>;

  readonly disconnect: () => E.Effect<void>;

  readonly status: E.Effect<LiveSplitConnectionStatus>;

  readonly statusChanges: Stream.Stream<LiveSplitConnectionStatus>;
};

const DISCONNECTED_STATUS = {
  _tag: "Disconnected",
} satisfies LiveSplitConnectionStatus;

const CONNECTED_STATUS = {
  _tag: "Connected",
} satisfies LiveSplitConnectionStatus;

const makeLiveSplitConnectionManager = E.gen(function* () {
  const appSettings = yield* AppSettings;

  const clientRef = yield* ScopedRef.make<
    Option.Option<LiveSplitClientService>
  >(() => Option.none());

  const statusRef =
    yield* SubscriptionRef.make<LiveSplitConnectionStatus>(DISCONNECTED_STATUS);

  const client: LiveSplitConnectionManagerService["client"] =
    ScopedRef.get(clientRef);

  const status: LiveSplitConnectionManagerService["status"] =
    SubscriptionRef.get(statusRef);

  const statusChanges: LiveSplitConnectionManagerService["statusChanges"] =
    SubscriptionRef.changes(statusRef);

  const connect: LiveSplitConnectionManagerService["connect"] = () => {
    const acquireClient = E.gen(function* () {
      const settings = yield* appSettings.get();

      const host = settings.liveSplitHost;
      const port = settings.liveSplitPort;

      yield* E.logInfo("Connecting to LiveSplit.", {
        host,
        port,
      });

      const transport = yield* makeNodeLiveSplitTransport({
        host,
        port,
      });

      yield* E.logDebug("LiveSplit transport created.", {
        host,
        port,
      });

      yield* transport.connected;

      yield* E.logDebug("LiveSplit TCP connection confirmed.", {
        host,
        port,
      });

      const liveSplitClient = yield* makeLiveSplitClient({
        transport,
      });

      yield* E.logDebug("LiveSplit client created.", {
        host,
        port,
      });

      yield* liveSplitClient.unavailability.pipe(
        Stream.runForEach((cause) => {
          return E.gen(function* () {
            yield* E.logWarning("LiveSplit client became unavailable.", {
              cause,
            });

            yield* SubscriptionRef.set(statusRef, DISCONNECTED_STATUS);

            yield* E.logInfo(
              "LiveSplit connection status changed to Disconnected.",
            );
          });
        }),
        E.forkScoped,
      );

      yield* E.logDebug("LiveSplit client availability watcher started.");

      return Option.some(liveSplitClient);
    }).pipe(
      E.tapCause((cause) => {
        return E.logError("Failed to acquire LiveSplit client.", {
          cause,
        });
      }),
      E.mapError((cause) => {
        return new LiveSplitConnectionError({
          cause,
        });
      }),
    );

    return E.gen(function* () {
      yield* E.logDebug("Installing LiveSplit client.");

      yield* ScopedRef.set(clientRef, acquireClient);

      yield* E.logDebug("LiveSplit client installed.");

      yield* SubscriptionRef.set(statusRef, CONNECTED_STATUS);

      yield* E.logInfo("LiveSplit connection status changed to Connected.");
    });
  };

  const disconnect: LiveSplitConnectionManagerService["disconnect"] = () => {
    return E.gen(function* () {
      yield* E.logInfo("Disconnecting from LiveSplit.");

      yield* ScopedRef.set(clientRef, E.succeedNone);
      yield* SubscriptionRef.set(statusRef, DISCONNECTED_STATUS);

      yield* E.logInfo("LiveSplit connection status changed to Disconnected.");
    });
  };

  return {
    client,
    connect,
    disconnect,
    status,
    statusChanges,
  } satisfies LiveSplitConnectionManagerService;
});

export class LiveSplitConnectionManager extends Context.Service<
  LiveSplitConnectionManager,
  LiveSplitConnectionManagerService
>()(
  "fellowship-run-tracker/services/live-split/core/live-split-connection-manager-service/LiveSplitConnectionManager",
) {
  static readonly layerNoDeps = Layer.effect(
    this,
    makeLiveSplitConnectionManager,
  );

  static readonly layerWith = (options: {
    readonly encryptionKeyDirectory: string;
  }) => {
    return this.layerNoDeps.pipe(Layer.provide(AppSettings.layerWith(options)));
  };
}
