import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";

import { makeRequestPacer } from "@frt/api/services/fellowship-logs-gateway/make-request-pacer.ts";

const MIN_QUERY_INTERVAL = "500 millis";

export type FellowshipLogsGatewayRequestPacerShape = {
  readonly pace: <A, Err, R>(
    effect: E.Effect<A, Err, R>,
  ) => E.Effect<A, Err, R>;
};

export class FellowshipLogsGatewayRequestPacer extends Context.Service<
  FellowshipLogsGatewayRequestPacer,
  FellowshipLogsGatewayRequestPacerShape
>()(
  "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-request-pacer/FellowshipLogsGatewayRequestPacer",
) {
  static readonly layer = Layer.effect(
    this,
    makeRequestPacer(MIN_QUERY_INTERVAL).pipe(
      E.map((pace) => {
        return { pace };
      }),
    ),
  );
}
