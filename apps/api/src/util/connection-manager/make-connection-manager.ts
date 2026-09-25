import * as E from "effect/Effect";
import * as Option from "effect/Option";
import type * as Scope from "effect/Scope";
import * as ScopedRef from "effect/ScopedRef";
import * as Stream from "effect/Stream";
import * as SubscriptionRef from "effect/SubscriptionRef";

export type ConnectionStatus =
  | {
      readonly _tag: "Disconnected";
    }
  | {
      readonly _tag: "Connected";
    };

export type ConnectionManager<Connection, AcquireError> = {
  readonly connection: E.Effect<Option.Option<Connection>>;

  readonly connect: () => E.Effect<void, AcquireError>;

  readonly disconnect: () => E.Effect<void>;

  readonly status: E.Effect<ConnectionStatus>;

  readonly statusChanges: Stream.Stream<ConnectionStatus>;
};

export type MakeConnectionManagerOptions<Connection, AcquireError> = {
  readonly acquire: E.Effect<Connection, AcquireError, Scope.Scope>;

  readonly getUnavailability: (
    connection: Connection,
  ) => Stream.Stream<unknown>;

  readonly name: string;
};

const DISCONNECTED_STATUS = {
  _tag: "Disconnected",
} satisfies ConnectionStatus;

const CONNECTED_STATUS = {
  _tag: "Connected",
} satisfies ConnectionStatus;

export function makeConnectionManager<Connection, AcquireError>({
  acquire,
  getUnavailability,
  name,
}: MakeConnectionManagerOptions<Connection, AcquireError>): E.Effect<
  ConnectionManager<Connection, AcquireError>,
  never,
  Scope.Scope
> {
  return E.gen(function* () {
    const connectionRef = yield* ScopedRef.make<Option.Option<Connection>>(() =>
      Option.none(),
    );

    const statusRef =
      yield* SubscriptionRef.make<ConnectionStatus>(DISCONNECTED_STATUS);

    const setDisconnected = E.gen(function* () {
      yield* SubscriptionRef.set(statusRef, DISCONNECTED_STATUS);

      yield* E.logInfo(`${name} connection status changed to Disconnected.`);
    });

    const acquireConnection = E.gen(function* () {
      const connection = yield* acquire;

      yield* getUnavailability(connection).pipe(
        Stream.runForEach((cause) => {
          return E.gen(function* () {
            yield* E.logWarning(`${name} connection became unavailable.`, {
              cause,
            });

            yield* setDisconnected;
          });
        }),
        E.forkScoped,
      );

      yield* E.logDebug(`${name} connection availability watcher started.`);

      return Option.some(connection);
    }).pipe(
      E.tapCause((cause) => {
        return E.logError(`Failed to acquire ${name} connection.`, {
          cause,
        });
      }),
    );

    const connect: ConnectionManager<Connection, AcquireError>["connect"] =
      () => {
        return E.gen(function* () {
          yield* E.logDebug(`Installing ${name} connection.`);

          yield* ScopedRef.set(connectionRef, acquireConnection);

          yield* E.logDebug(`${name} connection installed.`);

          yield* SubscriptionRef.set(statusRef, CONNECTED_STATUS);

          yield* E.logInfo(`${name} connection status changed to Connected.`);
        });
      };

    const disconnect: ConnectionManager<
      Connection,
      AcquireError
    >["disconnect"] = () => {
      return E.gen(function* () {
        yield* E.logInfo(`Disconnecting from ${name}.`);

        yield* ScopedRef.set(connectionRef, E.succeedNone);

        yield* setDisconnected;
      });
    };

    return {
      connect,
      connection: ScopedRef.get(connectionRef),
      disconnect,
      status: SubscriptionRef.get(statusRef),
      statusChanges: SubscriptionRef.changes(statusRef),
    } satisfies ConnectionManager<Connection, AcquireError>;
  });
}
