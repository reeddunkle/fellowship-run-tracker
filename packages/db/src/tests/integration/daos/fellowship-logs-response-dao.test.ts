import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { describe, expect, test } from "vitest";

import { FellowshipLogsResponseDAO } from "@frt/db/daos/fellowship-logs-response/fellowship-logs-response-dao.ts";
import { FellowshipLogsCacheDatabase } from "@frt/db/databases/fellowship-logs-cache-database.ts";
import { makeDatabasePersistenceTestLayer } from "@frt/db/tests/common/layers/database-persistence-test-layer.ts";
import { runTest } from "@frt/db/tests/common/run-test.ts";
import { FellowshipLogsFightIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { FellowshipLogsReportCodeSchema } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";

const REPORT_CODE = Schema.decodeSync(FellowshipLogsReportCodeSchema)(
  "report-a",
);

const OTHER_REPORT_CODE = Schema.decodeSync(FellowshipLogsReportCodeSchema)(
  "report-b",
);

const FIGHT_ID = Schema.decodeSync(FellowshipLogsFightIdSchema)(15);

const putResponse = E.fn("test.put-fellowship-logs-response")(function* (
  key: string,
  options?: {
    readonly byteSize?: number;
    readonly expiresAt?: DateTime.Utc | null;
    readonly reportCode?: typeof REPORT_CODE;
  },
) {
  const responseDAO = yield* FellowshipLogsResponseDAO;

  yield* responseDAO.put({
    body: new Uint8Array(options?.byteSize ?? 4),
    expiresAt: options?.expiresAt ?? null,
    fightId: FIGHT_ID,
    key,
    operation: "REPORT_PAGE",
    reportCode: options?.reportCode ?? REPORT_CODE,
    reportRevision: 55,
  });
});

/** Sets when a response was last used, so eviction order is predictable. */
const setLastAccessedAt = E.fn("test.set-last-accessed-at")(function* (
  key: string,
  lastAccessedAt: number,
) {
  const sql = yield* FellowshipLogsCacheDatabase;

  yield* sql`
    UPDATE fellowship_logs_response
    SET
      last_accessed_at = ${lastAccessedAt}
    WHERE
      request_key = ${key}
  `;
});

const listKeys = E.gen(function* () {
  const sql = yield* FellowshipLogsCacheDatabase;

  const rows = yield* sql<{ readonly requestKey: string }>`
    SELECT
      request_key
    FROM
      fellowship_logs_response
    ORDER BY
      request_key
  `;

  return rows.map((row) => {
    return row.requestKey;
  });
});

describe("FellowshipLogsResponseDAO", () => {
  test("saves a response and reads it back", async () => {
    const response = await E.gen(function* () {
      const responseDAO = yield* FellowshipLogsResponseDAO;

      yield* responseDAO.put({
        body: new Uint8Array([1, 2, 3]),
        expiresAt: null,
        fightId: FIGHT_ID,
        key: "key",
        operation: "FIGHT",
        reportCode: REPORT_CODE,
        reportRevision: 55,
      });

      return yield* responseDAO.get({ key: "key" });
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()), runTest);

    expect(Option.getOrThrow(response)).toMatchObject({
      body: new Uint8Array([1, 2, 3]),
      byteSize: 3,
      expiresAt: null,
      fightId: 15,
      operation: "FIGHT",
      reportCode: "report-a",
      reportRevision: 55,
      requestKey: "key",
    });
  });

  test("replaces a response saved under the same key", async () => {
    const response = await E.gen(function* () {
      const responseDAO = yield* FellowshipLogsResponseDAO;

      yield* putResponse("key", { byteSize: 4 });
      yield* putResponse("key", { byteSize: 8 });

      return yield* responseDAO.get({ key: "key" });
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()), runTest);

    expect(Option.getOrThrow(response).byteSize).toBe(8);
  });

  test("doesn't return an expired response, and deleteExpired removes it", async () => {
    const { deleted, expired, keys, live } = await E.gen(function* () {
      const responseDAO = yield* FellowshipLogsResponseDAO;
      const now = yield* DateTime.now;

      yield* putResponse("expired", {
        expiresAt: DateTime.subtract(now, { minutes: 1 }),
      });
      yield* putResponse("live", {
        expiresAt: DateTime.add(now, { minutes: 5 }),
      });
      yield* putResponse("kept");

      return {
        deleted: yield* responseDAO.deleteExpired(),
        expired: yield* responseDAO.get({ key: "expired" }),
        keys: yield* listKeys,
        live: yield* responseDAO.get({ key: "live" }),
      };
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()), runTest);

    expect(Option.isNone(expired)).toBe(true);
    expect(Option.isSome(live)).toBe(true);
    expect(deleted).toBe(1);
    expect(keys).toEqual(["kept", "live"]);
  });

  test("deleteForReport removes only that report's responses", async () => {
    const { deleted, keys } = await E.gen(function* () {
      const responseDAO = yield* FellowshipLogsResponseDAO;

      yield* putResponse("a-1");
      yield* putResponse("a-2");
      yield* putResponse("b-1", { reportCode: OTHER_REPORT_CODE });

      return {
        deleted: yield* responseDAO.deleteForReport({
          reportCode: REPORT_CODE,
        }),
        keys: yield* listKeys,
      };
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()), runTest);

    expect(deleted).toBe(2);
    expect(keys).toEqual(["b-1"]);
  });

  test("evictToSize keeps the most recently used responses that fit", async () => {
    const { evicted, keys } = await E.gen(function* () {
      const responseDAO = yield* FellowshipLogsResponseDAO;

      yield* putResponse("oldest", { byteSize: 10 });
      yield* putResponse("middle", { byteSize: 10 });
      yield* putResponse("newest", { byteSize: 10 });

      yield* setLastAccessedAt("oldest", 1000);
      yield* setLastAccessedAt("middle", 2000);
      yield* setLastAccessedAt("newest", 3000);

      return {
        evicted: yield* responseDAO.evictToSize({ maxBytes: 25 }),
        keys: yield* listKeys,
      };
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()), runTest);

    expect(evicted).toBe(1);
    expect(keys).toEqual(["middle", "newest"]);
  });

  test("touch marks a response as recently used, so it survives eviction", async () => {
    const keys = await E.gen(function* () {
      const responseDAO = yield* FellowshipLogsResponseDAO;

      yield* putResponse("used", { byteSize: 10 });
      yield* putResponse("unused", { byteSize: 10 });

      yield* setLastAccessedAt("used", 1000);
      yield* setLastAccessedAt("unused", 2000);

      yield* responseDAO.touch({ key: "used" });
      yield* responseDAO.evictToSize({ maxBytes: 10 });

      return yield* listKeys;
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()), runTest);

    expect(keys).toEqual(["used"]);
  });

  test("incrementalVacuum runs after responses are removed", async () => {
    await E.gen(function* () {
      const responseDAO = yield* FellowshipLogsResponseDAO;

      yield* putResponse("key", { byteSize: 100_000 });
      yield* responseDAO.delete({ key: "key" });
      yield* responseDAO.incrementalVacuum();
    }).pipe(E.provide(makeDatabasePersistenceTestLayer()), runTest);
  });
});
