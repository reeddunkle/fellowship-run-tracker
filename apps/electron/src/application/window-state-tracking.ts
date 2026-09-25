import { type BrowserWindow } from "electron";

const WINDOW_STATE_SAVE_DELAY_MILLISECONDS = 500;

const windowStateFlushes = new Set<() => Promise<void>>();
let hasFlushedWindowStateForQuit = false;

export function flushWindowStateSavesForQuit() {
  const flushed = Promise.all(
    [...windowStateFlushes].map((flush) => {
      return flush();
    }),
  );

  hasFlushedWindowStateForQuit = true;

  return flushed;
}

export function trackWindowStateSaves<Snapshot>({
  getSnapshot,
  save,
  subscribe,
  window,
}: {
  readonly getSnapshot: () => Snapshot | undefined;
  readonly save: (snapshot: Snapshot) => Promise<void>;
  readonly subscribe: (scheduleSave: () => void) => void;
  readonly window: BrowserWindow;
}) {
  let saveTimeout: NodeJS.Timeout | undefined;
  let pendingSave = Promise.resolve();

  function flush() {
    clearTimeout(saveTimeout);
    saveTimeout = undefined;

    if (window.isDestroyed() || hasFlushedWindowStateForQuit) {
      return pendingSave;
    }

    const snapshot = getSnapshot();

    if (snapshot !== undefined) {
      pendingSave = save(snapshot);
    }

    return pendingSave;
  }

  function scheduleSave() {
    clearTimeout(saveTimeout);
    // @effect-diagnostics-next-line globalTimers:off
    saveTimeout = setTimeout(flush, WINDOW_STATE_SAVE_DELAY_MILLISECONDS);
  }

  subscribe(scheduleSave);

  window.once("close", () => {
    void flush();
  });
  window.once("closed", () => {
    void pendingSave.finally(() => {
      windowStateFlushes.delete(flush);
    });
  });

  windowStateFlushes.add(flush);
}
