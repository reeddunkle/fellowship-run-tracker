import * as E from "effect/Effect";
import * as Predicate from "effect/Predicate";

import { RendererLoggerLayer } from "@/renderer/logging/renderer-logger-layer.ts";

const UNEXPECTED_ERROR_TAGS: ReadonlySet<string> = new Set([
  "HttpClientError",
  "SchemaError",
]);

function formatUnknownError(error: unknown) {
  return error instanceof Error
    ? (error.stack ?? error.message)
    : String(error);
}

export function isUnexpectedRendererError(error: unknown) {
  if (
    !Predicate.hasProperty(error, "_tag") ||
    !Predicate.isString(error._tag)
  ) {
    return true;
  }

  return UNEXPECTED_ERROR_TAGS.has(error._tag);
}

export function logRendererError(message: string, error: unknown) {
  E.runFork(
    E.logError(message, { cause: formatUnknownError(error) }).pipe(
      // @effect-diagnostics-next-line strictEffectProvide:off
      E.provide(RendererLoggerLayer),
    ),
  );
}

export function configureRendererErrorLogging() {
  window.addEventListener("error", (event) => {
    logRendererError("Uncaught renderer error.", event.error ?? event.message);
  });

  window.addEventListener("unhandledrejection", (event) => {
    logRendererError(
      "Unhandled promise rejection in the renderer.",
      event.reason,
    );
  });
}

export function logBoundaryError(error: unknown) {
  if (isUnexpectedRendererError(error)) {
    logRendererError("A renderer error boundary caught an error.", error);
  }
}
