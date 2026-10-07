import * as Tracer from "effect/Tracer";

export function makeRecordingTracer() {
  const spans: Array<Tracer.NativeSpan> = [];

  const tracer = Tracer.make({
    span: (options) => {
      const span = new Tracer.NativeSpan(options);
      spans.push(span);
      return span;
    },
  });

  return { spans, tracer };
}
