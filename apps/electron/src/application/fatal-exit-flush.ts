import { settleWithin } from "@/application/settle-within.ts";

type Flush = () => Promise<unknown>;

let registeredFlush: Flush | undefined;

export function registerFatalExitFlush(flush: Flush) {
  registeredFlush = flush;
}

export function flushBeforeFatalExit(timeoutMilliseconds: number) {
  if (registeredFlush === undefined) {
    return Promise.resolve();
  }

  return settleWithin(registeredFlush, timeoutMilliseconds);
}
