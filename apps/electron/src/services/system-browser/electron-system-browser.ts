import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";

import { SystemBrowserError } from "@frt/api/errors/system-browser-error.ts";
import {
  SystemBrowser,
  type SystemBrowserShape,
} from "@frt/api/services/system-browser/system-browser-service.ts";

export type ShellAdapter = {
  readonly openExternal: (url: string) => Promise<void>;
};

export function makeElectronSystemBrowser(
  shell: ShellAdapter,
): SystemBrowserShape {
  return {
    open: E.fn("SystemBrowser.open")(function* (url) {
      if (URL.parse(Redacted.value(url))?.protocol !== "https:") {
        return yield* new SystemBrowserError({ reason: "LaunchFailed" });
      }

      return yield* E.tryPromise({
        catch: () => new SystemBrowserError({ reason: "LaunchFailed" }),
        try: () => shell.openExternal(Redacted.value(url)),
      });
    }),
  };
}

export function makeElectronSystemBrowserLayer(shell: ShellAdapter) {
  return Layer.succeed(SystemBrowser, makeElectronSystemBrowser(shell));
}
