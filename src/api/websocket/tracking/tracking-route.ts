import * as E from "effect/Effect";
import * as HttpRouter from "effect/unstable/http/HttpRouter";
import * as HttpServerRequest from "effect/unstable/http/HttpServerRequest";
import * as HttpServerResponse from "effect/unstable/http/HttpServerResponse";

import { ROUTES } from "@/api/constants/routes.ts";
import { TrackingWebSocketBroadcaster } from "@/services/api/websocket-broadcaster-service.ts";

const handleTrackingRequest = E.gen(function* () {
  const request = yield* HttpServerRequest.HttpServerRequest;
  const trackingWebSocketBroadcaster = yield* TrackingWebSocketBroadcaster;

  yield* E.logDebug("Tracking WebSocket upgrade requested.", {
    method: request.method,
    url: request.url,
  });

  yield* E.scoped(
    E.gen(function* () {
      const socket = yield* request.upgrade;
      const writer = yield* socket.writer;

      yield* trackingWebSocketBroadcaster.registerClient(writer);

      yield* socket.runRaw(
        () => {
          return E.void;
        },
        {
          onOpen: E.gen(function* () {
            yield* E.logInfo("Tracking WebSocket client connected.", {
              url: request.url,
            });

            yield* trackingWebSocketBroadcaster.sendLatestToClient(writer);
          }),
        },
      );
    }),
  ).pipe(
    E.ensuring(
      E.logInfo("Tracking WebSocket client disconnected.", {
        url: request.url,
      }),
    ),
  );

  return HttpServerResponse.empty();
});

export const TrackingRoutes = HttpRouter.addAll([
  HttpRouter.route("GET", ROUTES.trackingEvents, handleTrackingRequest),
]);
