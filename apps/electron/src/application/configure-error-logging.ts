import * as E from "effect/Effect";
import type * as ManagedRuntime from "effect/ManagedRuntime";
import { app } from "electron";

// Navigations that replace an in-progress load report `did-fail-load` with
// ERR_ABORTED, which isn't a real failure.
const ERR_ABORTED = -3;

function formatError(error: Error) {
  return error.stack ?? error.message;
}

export function configureErrorLogging<R, ER>(
  runtime: ManagedRuntime.ManagedRuntime<R, ER>,
) {
  function log(effect: E.Effect<void>) {
    runtime.runFork(effect);
  }

  app.on("render-process-gone", (_event, _webContents, details) => {
    log(
      E.logError("[RENDERER] Render process gone.", {
        details,
      }),
    );
  });

  app.on("child-process-gone", (_event, details) => {
    if (details.reason === "clean-exit") {
      return;
    }

    log(
      E.logError("[CHILD PROCESS] Child process gone.", {
        details,
      }),
    );
  });

  app.on("web-contents-created", (_event, webContents) => {
    webContents.on("preload-error", (_preloadEvent, preloadPath, error) => {
      log(
        E.logError("[PRELOAD] Preload script failed.", {
          error: formatError(error),
          preloadPath,
        }),
      );
    });

    webContents.on(
      "did-fail-load",
      (_loadEvent, errorCode, errorDescription, validatedURL, isMainFrame) => {
        if (errorCode === ERR_ABORTED) {
          return;
        }

        log(
          E.logError("[RENDERER] Page failed to load.", {
            errorCode,
            errorDescription,
            isMainFrame,
            url: validatedURL,
          }),
        );
      },
    );

    webContents.on("console-message", (consoleEvent) => {
      if (consoleEvent.level !== "error") {
        return;
      }

      log(
        E.logError("[RENDERER] Console error.", {
          lineNumber: consoleEvent.lineNumber,
          message: consoleEvent.message,
          sourceId: consoleEvent.sourceId,
        }),
      );
    });
  });
}
