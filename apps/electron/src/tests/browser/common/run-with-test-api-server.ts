import * as E from "effect/Effect";
import * as Layer from "effect/Layer";

import { type makeApiServerTestLayerWith } from "@frt/api/tests/common/layers/api-server-test-layer.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";

import { type AppApiClient } from "@/renderer/services/app-api-client/app-api-client.ts";
import { TestAppApiClientTestLive } from "@/tests/browser/common/layers/app-api-client-test-layer.ts";

export function runWithTestApiServer<A, Error>(
  program: E.Effect<A, Error, AppApiClient>,
  apiServerLayer: ReturnType<typeof makeApiServerTestLayerWith>,
): Promise<A> {
  const TestLive = TestAppApiClientTestLive.pipe(Layer.provide(apiServerLayer));

  return program.pipe(E.provide(TestLive), E.scoped, runTest);
}
