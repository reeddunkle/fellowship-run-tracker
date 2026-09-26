import * as E from "effect/Effect";
import * as Option from "effect/Option";

import { type TelemetryAttributes } from "@frt/api/logging/with-telemetry-attributes.ts";

export function withLinkedRootSpan(
  name: string,
  attributes: TelemetryAttributes = {},
) {
  return <Success, Failure, Requirements>(
    effect: E.Effect<Success, Failure, Requirements>,
  ) => {
    return E.currentSpan.pipe(
      E.option,
      E.flatMap((startedBy) => {
        return effect.pipe(
          E.withSpan(name, {
            attributes: { ...attributes },
            links: Option.match(startedBy, {
              onNone: () => [],
              onSome: (span) => [{ attributes: {}, span }],
            }),
            root: true,
          }),
        );
      }),
    );
  };
}
