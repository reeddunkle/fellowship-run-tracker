import * as E from "effect/Effect";
import * as Redacted from "effect/Redacted";
import { describe, expect, test, vi } from "vitest";

import {
  makeElectronSystemBrowser,
  type ShellAdapter,
} from "@/services/system-browser/electron-system-browser.ts";

const AUTHORIZATION_URL =
  "https://www.fellowshiplogs.com/oauth/authorize?client_id=client-id&state=state";

function makeShell(
  openExternal: ShellAdapter["openExternal"] = () => Promise.resolve(),
) {
  return { openExternal: vi.fn(openExternal) };
}

describe("Electron system browser", () => {
  test("opens an HTTPS URL with the shell", async () => {
    const shell = makeShell();

    await E.runPromise(
      makeElectronSystemBrowser(shell).open(Redacted.make(AUTHORIZATION_URL)),
    );

    expect(shell.openExternal).toHaveBeenCalledWith(AUTHORIZATION_URL);
  });

  test("refuses non-HTTPS URLs without calling the shell", async () => {
    const shell = makeShell();

    const error = await E.runPromise(
      makeElectronSystemBrowser(shell)
        .open(Redacted.make("file:///C:/Windows/System32/calc.exe"))
        .pipe(E.flip),
    );

    expect(error.reason).toBe("LaunchFailed");
    expect(shell.openExternal).not.toHaveBeenCalled();
  });

  test("reports a launch failure without the URL", async () => {
    const shell = makeShell(() =>
      Promise.reject(new Error(`Failed to open ${AUTHORIZATION_URL}`)),
    );

    const error = await E.runPromise(
      makeElectronSystemBrowser(shell)
        .open(Redacted.make(AUTHORIZATION_URL))
        .pipe(E.flip),
    );

    expect(error.reason).toBe("LaunchFailed");
    expect(JSON.stringify(error)).not.toContain("state=state");
    expect(error.message).not.toContain("fellowshiplogs");
  });
});
