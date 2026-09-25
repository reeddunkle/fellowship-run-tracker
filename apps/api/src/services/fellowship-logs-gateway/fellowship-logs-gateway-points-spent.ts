import * as Context from "effect/Context";
import * as E from "effect/Effect";
import * as Ref from "effect/Ref";

const FellowshipLogsGatewayPointsSpent =
  Context.Reference<Ref.Ref<number> | null>(
    "@frt/api/services/fellowship-logs-gateway/fellowship-logs-gateway-points-spent/FellowshipLogsGatewayPointsSpent",
    {
      defaultValue: () => {
        return null;
      },
    },
  );

export function addFellowshipLogsGatewayPointsSpent(points: number) {
  return E.gen(function* () {
    const pointsSpent = yield* FellowshipLogsGatewayPointsSpent;

    if (pointsSpent !== null) {
      yield* Ref.update(pointsSpent, (total) => {
        return total + points;
      });
    }
  });
}

export function withFellowshipLogsGatewayPointsSpent<A, Err, Requirements>(
  effect: E.Effect<A, Err, Requirements>,
) {
  return E.gen(function* () {
    const pointsSpent = yield* Ref.make(0);

    const result = yield* effect.pipe(
      E.provideService(FellowshipLogsGatewayPointsSpent, pointsSpent),
    );

    return [result, yield* Ref.get(pointsSpent)] as const;
  });
}
