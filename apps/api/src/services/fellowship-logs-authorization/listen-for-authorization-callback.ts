// @effect-diagnostics-next-line nodeBuiltinImport:off
import * as Http from "node:http";

import * as E from "effect/Effect";
import type * as Scope from "effect/Scope";

import { FellowshipLogsAuthorizationError } from "@frt/api/errors/fellowship-logs-authorization-error.ts";
import {
  type FellowshipLogsRedirectUri,
  FellowshipLogsRedirectUriSchema,
} from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";

const FELLOWSHIP_LOGS_REDIRECT_HOSTNAME = "127.0.0.1";
const FELLOWSHIP_LOGS_REDIRECT_PATH = "/oauth/callback";

const CALLBACK_RESPONSE_BODY =
  "<!doctype html><meta charset=utf-8><title>Fellowship Run Tracker</title><p>Fellowship Run Tracker received the Fellowship Logs response. You can close this tab and return to the app.</p>";

const RESPONSE_HEADERS = {
  "Cache-Control": "no-store",
  Connection: "close",
  "Content-Security-Policy": "default-src 'none'",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

type CallbackListener = {
  readonly redirectUri: FellowshipLogsRedirectUri;
  readonly server: Http.Server;
};

function getListeningPort(server: Http.Server) {
  const address = server.address();

  return typeof address === "object" && address !== null ? address.port : null;
}

function handleRequest(
  server: Http.Server,
  request: Http.IncomingMessage,
  response: Http.ServerResponse,
  onCallback: (callbackUrl: string) => void,
) {
  const port = getListeningPort(server);
  const origin = `http://${FELLOWSHIP_LOGS_REDIRECT_HOSTNAME}:${port}`;
  const url = URL.parse(request.url ?? "", origin);

  if (
    port === null ||
    url === null ||
    request.headers.host !== `${FELLOWSHIP_LOGS_REDIRECT_HOSTNAME}:${port}` ||
    url.pathname !== FELLOWSHIP_LOGS_REDIRECT_PATH
  ) {
    response.writeHead(404, RESPONSE_HEADERS).end();
    return;
  }

  if (request.method !== "GET") {
    response.writeHead(405, { ...RESPONSE_HEADERS, Allow: "GET" }).end();
    return;
  }

  response
    .writeHead(200, {
      ...RESPONSE_HEADERS,
      "Content-Type": "text/html; charset=utf-8",
    })
    .end(CALLBACK_RESPONSE_BODY);
  onCallback(url.toString());
}

function closeServer(server: Http.Server) {
  server.close();
  server.closeAllConnections();
}

const startCallbackListener = (onCallback: (callbackUrl: string) => void) =>
  E.callback<CallbackListener, FellowshipLogsAuthorizationError>((resume) => {
    const server = Http.createServer((request, response) => {
      handleRequest(server, request, response, onCallback);
    });

    server.once("error", (cause) => {
      closeServer(server);
      resume(
        E.fail(
          new FellowshipLogsAuthorizationError({ cause, operation: "Listen" }),
        ),
      );
    });
    server.listen(0, FELLOWSHIP_LOGS_REDIRECT_HOSTNAME, () => {
      const port = getListeningPort(server);

      resume(
        E.succeed({
          redirectUri: FellowshipLogsRedirectUriSchema.make(
            `http://${FELLOWSHIP_LOGS_REDIRECT_HOSTNAME}:${port}${FELLOWSHIP_LOGS_REDIRECT_PATH}`,
          ),
          server,
        }),
      );
    });

    return E.sync(() => {
      closeServer(server);
    });
  });

export const listenForAuthorizationCallback = (
  onCallback: (callbackUrl: string) => void,
): E.Effect<
  FellowshipLogsRedirectUri,
  FellowshipLogsAuthorizationError,
  Scope.Scope
> =>
  E.acquireRelease(startCallbackListener(onCallback), ({ server }) =>
    E.sync(() => {
      closeServer(server);
    }),
  ).pipe(E.map(({ redirectUri }) => redirectUri));
