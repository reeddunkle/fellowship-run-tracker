import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import * as HttpServer from "effect/unstable/http/HttpServer";
import { describe, expect, test } from "vitest";

import {
  getEncounterBase,
  getEncountersBase,
} from "@/electron/renderer/api/encounter-client.ts";
import { type EncounterApiEncounter } from "@/services/api/encounter/encounter-api-schema.ts";
import { makeApiServerTestLayerWith } from "@/tests/common/layers/api-server-test-layer.ts";
import { makeEncounterApiServiceMock } from "@/tests/common/mocks/encounter-api-service-mock.ts";
import { runTest } from "@/tests/common/run-test.ts";

const DUNGEON_ID = "24";
const ENCOUNTER_ID = "33";
const UNKNOWN_ENCOUNTER_ID = "999999";

const MOCK_CREATED_AT = DateTime.makeUnsafe("2026-01-01T00:00:00.000Z");
const MOCK_UPDATED_AT = DateTime.makeUnsafe("2026-01-01T00:00:00.000Z");

const encounter = {
  createdAt: MOCK_CREATED_AT,
  dungeonId: DUNGEON_ID,
  id: ENCOUNTER_ID,
  name: "Vexira",
  updatedAt: MOCK_UPDATED_AT,
} satisfies EncounterApiEncounter;

function getHttpUrl(address: HttpServer.Address): string {
  if (address._tag === "UnixAddress") {
    throw new Error("HTTP test does not support Unix socket addresses.");
  }

  const hostname =
    address.hostname === "0.0.0.0" ? "127.0.0.1" : address.hostname;

  return `http://${hostname}:${address.port}`;
}

describe("encounter client", () => {
  test("gets all encounters", async () => {
    const encounterApiServiceMock = makeEncounterApiServiceMock({
      getAll: () => {
        return E.succeed([encounter]);
      },
    });

    const TestLive = Layer.mergeAll(
      makeApiServerTestLayerWith(encounterApiServiceMock),
      FetchHttpClient.layer,
    );

    const program = E.scoped(
      E.gen(function* () {
        const httpServer = yield* HttpServer.HttpServer;
        const baseUrl = getHttpUrl(httpServer.address);

        const getEncounters = getEncountersBase(baseUrl);

        const encounters = yield* getEncounters();

        expect(encounters).toEqual([encounter]);
      }).pipe(E.provide(TestLive)),
    );

    await runTest(program);
  });

  test("gets an encounter", async () => {
    const encounterApiServiceMock = makeEncounterApiServiceMock({
      getById: ({ dungeonId, id }) => {
        if (dungeonId === DUNGEON_ID && id === ENCOUNTER_ID) {
          return E.succeedSome(encounter);
        }

        return E.succeedNone;
      },
    });

    const TestLive = Layer.mergeAll(
      makeApiServerTestLayerWith(encounterApiServiceMock),
      FetchHttpClient.layer,
    );

    const program = E.scoped(
      E.gen(function* () {
        const httpServer = yield* HttpServer.HttpServer;
        const baseUrl = getHttpUrl(httpServer.address);

        const getEncounter = getEncounterBase(baseUrl);

        const result = yield* getEncounter({
          dungeonId: DUNGEON_ID,
          id: ENCOUNTER_ID,
        });

        expect(result).toEqual(encounter);
      }).pipe(E.provide(TestLive)),
    );

    await runTest(program);
  });

  test("returns NotFound when an encounter does not exist", async () => {
    const encounterApiServiceMock = makeEncounterApiServiceMock();

    const TestLive = Layer.mergeAll(
      makeApiServerTestLayerWith(encounterApiServiceMock),
      FetchHttpClient.layer,
    );

    const program = E.scoped(
      E.gen(function* () {
        const httpServer = yield* HttpServer.HttpServer;
        const baseUrl = getHttpUrl(httpServer.address);

        const getEncounter = getEncounterBase(baseUrl);

        const wasNotFound = yield* getEncounter({
          dungeonId: DUNGEON_ID,
          id: UNKNOWN_ENCOUNTER_ID,
        }).pipe(
          E.as(false),
          E.catchTag("NotFound", () => {
            return E.succeed(true);
          }),
        );

        expect(wasNotFound).toBe(true);
      }).pipe(E.provide(TestLive)),
    );

    await runTest(program);
  });
});
