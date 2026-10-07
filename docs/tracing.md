# Tracing

A span marks a public service boundary or a meaningful operation. Everything else runs untraced.

A span is worth having when it does I/O (filesystem, SQL, HTTP, WebSocket), persistence, or crypto, or when it is work you would want to see as its own bar while debugging a trace. Ask "would I look for this in the trace file?" If not, use `E.fnUntraced`.

## Choosing a wrapper

| Function | Wrapper |
| --- | --- |
| Public service method that returns an Effect | `E.fn("ServiceClass.method")`, even when it only delegates to one already-traced call |
| Public service member that is an Effect value | `.pipe(E.withSpan("ServiceClass.member"))` |
| Public service method that returns a `Stream` | Untraced. A stream span stays open for the whole subscription. |
| Public service member that only reads or writes in-memory state (a `Ref`, `PubSub` or `Queue`) | Untraced |
| Public service property that references another service's method directly (`cancel: queue.cancel`) | Untraced. The referenced method carries its own span. |
| Standalone exported operation that does I/O | `E.fn("functionName")` |
| Constructor (`makeX`) that takes arguments | `E.fnUntraced`. It runs once at layer build. |
| Constructor with no arguments | `const makeX = E.gen(function* () { ... })` |
| HttpApi group builder (`XApi.handlers`) | `E.fnUntraced`. It runs at layer build, and the platform middleware already traces each request. |
| Error mappers and recovery callbacks (`map*ApiError`, `logInternalServerError`, `catchCause` / `catch` / `catchTag` callbacks) | `E.fnUntraced` |
| Private helper inside a constructor | `E.fnUntraced`. Exception: a helper that does I/O gets `E.fn("ServiceClass.helper")`. |
| Private helper shared by traced public methods (`finishLocal` behind `completeLocal` / `exitLocal` / `interruptLocal`) | `E.fnUntraced`. The public method's span already names the operation. |
| Per-item hot path (once per log line, once per gateway event, once per directory watcher event) | `E.fnUntraced` |
| Function whose body is a log call | `E.fnUntraced`. The log line already records it. |
| Renderer code other than API client calls | `E.fnUntraced` |
| Renderer API client call | `E.fn("<Domain>ApiClient.method")`, e.g. `TrackingApiClient.startTracking` |
| Test helper | `E.fnUntraced`, unless the test asserts on spans |
| Inline callback | `E.gen` |

Trace a public method even when it only delegates. Whether to trace can then be decided from the method alone, without checking whether its callee is traced. That check would break silently if the callee later became untraced.

DAO method spans are the only record of SQL in a trace, because `FilterNoisySpansLayer` drops `sql.execute` spans.

`effectFnOpportunity` is set to `"error"` in `tsconfig.effect.base.json`, so a named function that returns `E.gen` must use one of the two. The quickfix offers both `span` and `untraced`. Pick deliberately.

## Span names

- The prefix of a service method is the `Context.Service` class the method belongs to, never the implementation or file name. The simulated importer and the real one both produce `FellowshipLogsDungeonRunImporter.importReport`, and the gateway fixture and the real gateway both produce `FellowshipLogsGateway.*`, so traces look the same whichever implementation is live.
- A closure or utility that is not a `Context.Service` (a connection manager, a rate limit tracker) takes the prefix of the service that owns it, or runs untraced and lets that service's method carry the span.
- A traced private helper takes the service prefix too: `FileMonitor.readAppendedLines`.
- A standalone function uses its bare camelCase name, matching the variable: `splitFellowshipLogFile`.
- Never use kebab-case or dotted namespaces such as `cli.capture-report.credentials`.
- Root spans created with `withLinkedRootSpan` follow the same `ServiceClass.member` form: `FellowshipTracker.session`, `LiveSplitGateway.connection`.

## Combinators

Pass trailing combinators to `E.fn` / `E.fnUntraced` as extra arguments instead of piping the result. A combinator that needs the call's arguments receives them after the effect:

```ts
const runClaimedJob = E.fn("BackgroundJobQueue.runClaimedJob")(
  function* (claimed: BackgroundJobModel) { ... },
  (effect, claimed) => {
    return effect.pipe(
      withTelemetryAttributes(getJobTelemetryAttributes(claimed)),
      E.ensuring(releaseJob(claimed.id)),
    );
  },
);
```

A body wrapped entirely in `sql.withTransaction(E.gen(...))` or `semaphore.withPermit(E.gen(...))` should move the wrapper to the combinator argument instead.

Move a wrapper only when it already applies to the whole body. A `mapError` or `catch` on just the last step stays where it is, because as a combinator it would also handle errors from every earlier step.

## Span attributes

Use `withTelemetryAttributes` from `@frt/api/logging/with-telemetry-attributes.ts`. It annotates both the current span and the logs, so the same context appears in the trace file and the log file. Use `E.annotateCurrentSpan` directly only when the value shouldn't be logged.

Attribute keys are dotted snake_case under a domain prefix: `fellowship.dungeon_id`, `fellowship.tracker.source`, `background_job.kind`, `livesplit.command`.

## Root spans and propagation

- A long-lived fiber that outlives its caller (the tracking session, the LiveSplit connection) runs under `withLinkedRootSpan`. That starts a new trace linked to the span that started it, rather than nesting a session-length span inside a short request span.
- Background jobs store the W3C `traceparent` of the span that enqueued them and restore it with `E.withParentSpan` when they run, so a job's trace continues from the request that enqueued it.
- `FilterNoisySpansLayer` drops `sql.execute` spans.

## Exporters

`AppObservabilityLayer` in `apps/api/src/services/observability/app-observability-layer.ts` is used by the Electron main process and the CLI.

- When `OTEL_EXPORTER_OTLP_ENDPOINT` is set, traces, logs and metrics go to that OTLP endpoint.
- Otherwise traces are appended to the session trace file in the logs directory.

## Renderer

The renderer has no tracer layer yet, so its spans are not exported. The renderer is set up so that tracing can be added later without renaming anything:

- Only API client calls in `renderer/api/*/*-client.ts` are traced, named `<Domain>ApiClient.<function>` after the client file. These are the spans that will later be connected to backend spans.
- Everything else in the renderer is `E.fnUntraced`.
- `HttpClient.TracerPropagationEnabled` stays `false` in `browser-runtime.ts` until a renderer exporter exists. Turning it on before then would send backend spans a parent span ID that never gets exported.

When renderer tracing is added, forward spans to main over IPC, then enable propagation.

## Tests

Test helpers use `E.fnUntraced`. Tests that assert on spans depend on production spans, so some production spans are load-bearing:

- `background-job-queue.test.ts` needs `BackgroundJobQueue.offer` and `BackgroundJobQueue.runClaimedJob` to stay traced.
- `fellowship-logs-gateway-span-redaction.test.ts` asserts on `http.client` spans from the platform, not on `E.fn` spans.
- `live-split.test.ts` needs `LiveSplit.handleRunEvent` to stay traced while LiveSplit is connected, and asserts that no `LiveSplit*` spans are recorded while it is disconnected.

## Differences from Effect-TS/janitor

This convention follows the approach of [Effect-TS/janitor](https://github.com/Effect-TS/janitor): name spans after the public method of a service, and run constructors, framework-owned boundaries, error callbacks and internals untraced. It differs in three ways:

- Every public service method with I/O is traced. Janitor leaves some services entirely unspanned.
- Span attributes are used. Janitor has no tracer and puts context only in logs.
- Root spans and `traceparent` propagation into background jobs are used.
