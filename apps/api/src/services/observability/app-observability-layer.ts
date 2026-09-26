import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Otlp from "effect/unstable/observability/Otlp";
import * as OtlpSerialization from "effect/unstable/observability/OtlpSerialization";
import * as OtlpTracer from "effect/unstable/observability/OtlpTracer";

import { appConfig } from "@frt/api/app-config.ts";
import {
  NodeFileSystemLayer,
  NodeHttpClientLayer,
  NodePathLayer,
} from "@frt/api/layers/node-platform-layer.ts";
import { SESSION_TRACE_FILE_PATH } from "@frt/api/logging/log-file-path.ts";
import { AppLoggerLayer } from "@frt/api/services/logging/app-logger-service.ts";
import { makeFileOtlpHttpClientLayer } from "@frt/api/services/observability/file-otlp-http-client.ts";
import { FilterNoisySpansLayer } from "@frt/api/services/observability/filter-noisy-spans-layer.ts";

const SERVICE_NAME = "fellowship-run-tracker";

const SHUTDOWN_TIMEOUT = "3 seconds";

const TRACE_FILE_MAX_BYTES = 50 * 1024 * 1024;

const FILE_TRACES_URL = "file:///v1/traces";

type AppObservabilityOptions = {
  readonly serviceVersion: string;
};

type OtlpResource = {
  readonly serviceName: string;
  readonly serviceVersion: string;
};

function makeFileTracingLayer(resource: OtlpResource) {
  return FilterNoisySpansLayer.pipe(
    Layer.provide(
      OtlpTracer.layer({
        resource,
        shutdownTimeout: SHUTDOWN_TIMEOUT,
        url: FILE_TRACES_URL,
      }),
    ),
    Layer.provide(OtlpSerialization.layerJson),
    Layer.provide(
      makeFileOtlpHttpClientLayer({
        filePath: SESSION_TRACE_FILE_PATH,
        maxBytes: TRACE_FILE_MAX_BYTES,
      }),
    ),
    Layer.provide(NodeFileSystemLayer),
    Layer.provide(NodePathLayer),
  );
}

function makeCollectorTelemetryLayer(resource: OtlpResource, endpoint: URL) {
  return Otlp.layerJson({
    baseUrl: endpoint.toString(),
    resource,
    shutdownTimeout: SHUTDOWN_TIMEOUT,
  }).pipe(Layer.provide(NodeHttpClientLayer));
}

export function makeAppObservabilityLayer({
  serviceVersion,
}: AppObservabilityOptions) {
  const resource = { serviceName: SERVICE_NAME, serviceVersion };

  const TelemetryLayer = Layer.unwrap(
    E.gen(function* () {
      const endpoint = yield* appConfig.otelExporterOtlpEndpoint;

      return Option.match(endpoint, {
        onNone: () => makeFileTracingLayer(resource),
        onSome: (url) => makeCollectorTelemetryLayer(resource, url),
      });
    }),
  );

  return TelemetryLayer.pipe(Layer.provideMerge(AppLoggerLayer));
}
