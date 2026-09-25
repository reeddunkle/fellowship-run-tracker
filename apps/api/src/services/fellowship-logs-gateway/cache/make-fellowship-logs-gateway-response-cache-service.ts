import { promisify } from "node:util";
import { gunzip, gzip } from "node:zlib";

import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as E from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";

import { FellowshipLogsGatewayResponseCacheCompressionError } from "@frt/api/errors/fellowship-logs-gateway-response-cache-error.ts";
import {
  type FellowshipLogsCachedRequest,
  type FellowshipLogsGatewayResponseCacheShape,
} from "@frt/api/services/fellowship-logs-gateway/cache/fellowship-logs-gateway-response-cache-service.ts";
import { FellowshipLogsResponseDAO } from "@frt/db/daos/fellowship-logs-response/fellowship-logs-response-dao.ts";

const gzipAsync = promisify(gzip);
const gunzipAsync = promisify(gunzip);

const LAST_ACCESSED_AT_REFRESH_INTERVAL = Duration.days(1);

function compress(json: string) {
  return E.tryPromise({
    catch: (cause) => {
      return new FellowshipLogsGatewayResponseCacheCompressionError({
        cause,
        operation: "Compress",
      });
    },
    try: () => {
      return gzipAsync(json);
    },
  });
}

function decompress(body: Uint8Array) {
  return E.tryPromise({
    catch: (cause) => {
      return new FellowshipLogsGatewayResponseCacheCompressionError({
        cause,
        operation: "Decompress",
      });
    },
    try: () => {
      return gunzipAsync(body);
    },
  }).pipe(
    E.map((json) => {
      return json.toString("utf8");
    }),
  );
}

export const makeFellowshipLogsGatewayResponseCache = E.gen(function* () {
  const responseDAO = yield* FellowshipLogsResponseDAO;

  const read = E.fn("FellowshipLogsGatewayResponseCache.read")(function* <
    ResponseSchema extends Schema.Codec<unknown, unknown>,
  >(request: FellowshipLogsCachedRequest<ResponseSchema>) {
    const { key } = request;

    const cachedResponse = yield* responseDAO.get({ key }).pipe(
      E.catch((cause) => {
        return E.logWarning(
          "Couldn't read the Fellowship Logs cache; fetching instead.",
          { cause, key },
        ).pipe(E.as(Option.none()));
      }),
    );

    if (Option.isNone(cachedResponse)) {
      return Option.none<ResponseSchema["Type"]>();
    }

    const decoded = yield* decompress(cachedResponse.value.body).pipe(
      E.flatMap(Schema.decodeEffect(Schema.fromJsonString(request.schema))),
      E.option,
    );

    if (Option.isNone(decoded)) {
      yield* E.logInfo(
        "Dropping a cached Fellowship Logs response that can't be read.",
        { key },
      );
      yield* responseDAO.delete({ key }).pipe(E.ignore);

      return Option.none<ResponseSchema["Type"]>();
    }

    const now = yield* DateTime.now;

    const refreshAfter = DateTime.addDuration(
      cachedResponse.value.lastAccessedAt,
      LAST_ACCESSED_AT_REFRESH_INTERVAL,
    );

    if (DateTime.isGreaterThan(now, refreshAfter)) {
      yield* responseDAO.touch({ key }).pipe(E.ignore);
    }

    return decoded;
  });

  const write = E.fn("FellowshipLogsGatewayResponseCache.write")(function* <
    ResponseSchema extends Schema.Codec<unknown, unknown>,
  >(
    request: FellowshipLogsCachedRequest<ResponseSchema>,
    data: ResponseSchema["Type"],
  ) {
    const now = yield* DateTime.now;
    const expiresAt = request.getExpiresAt(data, now);

    if (Option.isNone(expiresAt)) {
      return;
    }

    yield* Schema.encodeEffect(Schema.fromJsonString(request.schema))(
      data,
    ).pipe(
      E.flatMap(compress),
      E.flatMap((body) => {
        return responseDAO.put({
          body,
          expiresAt: expiresAt.value,
          fightId: request.fightId,
          key: request.key,
          operation: request.operation,
          reportCode: request.reportCode,
          reportRevision: request.getReportRevision?.(data) ?? null,
        });
      }),
      E.catch((cause) => {
        return E.logWarning("Couldn't cache a Fellowship Logs response.", {
          cause,
          key: request.key,
        });
      }),
    );
  });

  const cached: FellowshipLogsGatewayResponseCacheShape["cached"] = (
    request,
    fetch,
  ) => {
    return E.gen(function* () {
      const cachedData = yield* read(request);

      if (Option.isSome(cachedData)) {
        return cachedData.value;
      }

      const data = yield* fetch;

      yield* write(request, data);

      return data;
    });
  };

  return {
    cached,
  } satisfies FellowshipLogsGatewayResponseCacheShape;
});
