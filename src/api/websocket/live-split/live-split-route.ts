import * as E from "effect/Effect";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";

import { ROUTES } from "@/api/constants/routes.ts";
import { LiveSplitWebSocketBroadcaster } from "@/services/api/websocket-broadcaster-service.ts";

const handleLiveSplitRequest = E.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const liveSplitWebSocketBroadcaster = yield* LiveSplitWebSocketBroadcaster;

  yield* E.logDebug("LiveSplit WebSocket upgrade requested.", {
    method: request.method,
    url: request.url,
  });

  yield* E.scoped(
    E.gen(function* () {
      const socket = yield* request.upgrade;
      const writer = yield* socket.writer;

      yield* liveSplitWebSocketBroadcaster.registerClient(writer);

      yield* socket.runRaw(
        () => {
          return E.void;
        },
        {
          onOpen: E.gen(function* () {
            yield* E.logInfo("LiveSplit WebSocket client connected.", {
              url: request.url,
            });

            yield* liveSplitWebSocketBroadcaster.sendLatestToClient(writer);
          }),
        },
      );
    }),
  ).pipe(
    E.ensuring(
      E.logInfo("LiveSplit WebSocket client disconnected.", {
        url: request.url,
      }),
    ),
  );

  return HttpServerResponse.empty();
});

export const LiveSplitRoutes = HttpRouter.addAll([
  HttpRouter.route("GET", ROUTES.liveSplitEvents, handleLiveSplitRequest),
]);
