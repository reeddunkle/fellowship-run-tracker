import * as E from "effect/Effect";

export type TelemetryAttributes = Readonly<Record<string, unknown>>;

export function withTelemetryAttributes(attributes: TelemetryAttributes) {
  return <Success, Failure, Requirements>(
    effect: E.Effect<Success, Failure, Requirements>,
  ) => {
    return E.annotateCurrentSpan(attributes).pipe(
      E.andThen(effect),
      E.annotateLogs(attributes),
    );
  };
}
