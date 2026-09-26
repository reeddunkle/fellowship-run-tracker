import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Tracer from "effect/Tracer";

const NOISY_SPAN_NAMES: ReadonlySet<string> = new Set(["sql.execute"]);

export const FilterNoisySpansLayer = Layer.effect(
  Tracer.Tracer,
  E.gen(function* () {
    const tracer = yield* E.tracer;

    return Tracer.make({
      context: tracer.context,
      span: (options) => {
        return tracer.span(
          NOISY_SPAN_NAMES.has(options.name)
            ? { ...options, sampled: false }
            : options,
        );
      },
    });
  }),
);
