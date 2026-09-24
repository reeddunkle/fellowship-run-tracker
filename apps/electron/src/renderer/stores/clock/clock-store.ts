import * as DateTime from "effect/DateTime";

const CLOCK_INTERVAL_MILLISECONDS = 5_000;

export type ClockStore = {
  readonly getSnapshot: () => number;
  readonly subscribe: (listener: Listener) => () => void;
};

type Listener = () => void;

function getNowMilliseconds(): number {
  return DateTime.toEpochMillis(DateTime.nowUnsafe());
}

function makeClockStore(): ClockStore {
  let nowMilliseconds = getNowMilliseconds();
  let intervalId: number | undefined;

  const listeners = new Set<Listener>();

  function emit(): void {
    listeners.forEach((listener) => {
      listener();
    });
  }

  function tick(): void {
    nowMilliseconds = getNowMilliseconds();

    emit();
  }

  function start(): void {
    if (intervalId !== undefined) {
      return;
    }

    nowMilliseconds = getNowMilliseconds();
    intervalId = window.setInterval(tick, CLOCK_INTERVAL_MILLISECONDS);
  }

  function stop(): void {
    if (intervalId === undefined) {
      return;
    }

    window.clearInterval(intervalId);
    intervalId = undefined;
  }

  function subscribe(listener: Listener): () => void {
    listeners.add(listener);
    start();

    return () => {
      listeners.delete(listener);

      if (listeners.size === 0) {
        stop();
      }
    };
  }

  function getSnapshot(): number {
    return nowMilliseconds;
  }

  return {
    getSnapshot,
    subscribe,
  };
}

export const clockStore = makeClockStore();
