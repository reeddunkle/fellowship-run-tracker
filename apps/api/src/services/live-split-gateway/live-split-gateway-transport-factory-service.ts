import * as Context from "effect/Context";
import type * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import type * as Scope from "effect/Scope";
import type * as Socket from "effect/unstable/socket/Socket";

import {
  type LiveSplitGatewayTransport,
  type MakeNodeLiveSplitGatewayTransportOptions,
  makeNodeLiveSplitGatewayTransport,
} from "@frt/api/services/live-split-gateway/node-live-split-gateway-transport.ts";

export type LiveSplitGatewayTransportFactoryShape = {
  readonly open: (
    options: MakeNodeLiveSplitGatewayTransportOptions,
  ) => E.Effect<LiveSplitGatewayTransport, Socket.SocketError, Scope.Scope>;
};

export class LiveSplitGatewayTransportFactory extends Context.Service<
  LiveSplitGatewayTransportFactory,
  LiveSplitGatewayTransportFactoryShape
>()(
  "@frt/api/services/live-split-gateway/live-split-gateway-transport-factory-service/LiveSplitGatewayTransportFactory",
) {
  static readonly layer = Layer.succeed(this, {
    open: makeNodeLiveSplitGatewayTransport,
  } satisfies LiveSplitGatewayTransportFactoryShape);
}
