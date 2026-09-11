import * as E from "effect/Effect";
import * as Queue from "effect/Queue";
import * as Stream from "effect/Stream";

export function makeStreamTestHarness<Value, Error, Requirements>(
  stream: Stream.Stream<Value, Error, Requirements>,
) {
  return E.gen(function* () {
    const values = yield* Queue.make<Value>();

    yield* stream.pipe(
      Stream.runForEach((value) => {
        return Queue.offer(values, value);
      }),
      E.forkScoped,
    );

    return {
      take: Queue.take(values),
    };
  });
}
