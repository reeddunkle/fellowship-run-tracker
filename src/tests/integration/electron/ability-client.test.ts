import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import * as HttpServer from "effect/unstable/http/HttpServer";
import { describe, expect, test } from "vitest";

import {
  getAbilitiesBase,
  getAbilityBase,
} from "@/electron/renderer/api/ability-client.ts";
import { type AbilityApiAbility } from "@/services/api/ability/ability-api-schema.ts";
import { makeApiServerTestLayerWith } from "@/tests/common/layers/api-server-test-layer.ts";
import { makeAbilityApiServiceMock } from "@/tests/common/mocks/ability-api-service-mock.ts";
import { runTest } from "@/tests/common/run-test.ts";

const ABILITY_ID = "634";
const UNIT_ID = "133";
const UNKNOWN_ABILITY_ID = "999999";

const MOCK_CREATED_AT = DateTime.makeUnsafe("2026-01-01T00:00:00.000Z");
const MOCK_UPDATED_AT = DateTime.makeUnsafe("2026-01-01T00:00:00.000Z");

const ability = {
  createdAt: MOCK_CREATED_AT,
  id: ABILITY_ID,
  name: "Stormy Retreat",
  unitId: UNIT_ID,
  updatedAt: MOCK_UPDATED_AT,
} satisfies AbilityApiAbility;

function getHttpUrl(address: HttpServer.Address): string {
  if (address._tag === "UnixAddress") {
    throw new Error("HTTP test does not support Unix socket addresses.");
  }

  const hostname =
    address.hostname === "0.0.0.0" ? "127.0.0.1" : address.hostname;

  return `http://${hostname}:${address.port}`;
}

describe("ability client", () => {
  test("gets all abilities", async () => {
    const abilityApiServiceMock = makeAbilityApiServiceMock({
      getAll: () => {
        return E.succeed([ability]);
      },
    });

    const TestLive = Layer.mergeAll(
      makeApiServerTestLayerWith(abilityApiServiceMock),
      FetchHttpClient.layer,
    );

    const program = E.scoped(
      E.gen(function* () {
        const httpServer = yield* HttpServer.HttpServer;
        const baseUrl = getHttpUrl(httpServer.address);

        const getAbilities = getAbilitiesBase(baseUrl);

        const abilities = yield* getAbilities();

        expect(abilities).toEqual([ability]);
      }).pipe(E.provide(TestLive)),
    );

    await runTest(program);
  });

  test("gets an ability", async () => {
    const abilityApiServiceMock = makeAbilityApiServiceMock({
      getById: ({ id }) => {
        if (id === ABILITY_ID) {
          return E.succeedSome(ability);
        }

        return E.succeedNone;
      },
    });

    const TestLive = Layer.mergeAll(
      makeApiServerTestLayerWith(abilityApiServiceMock),
      FetchHttpClient.layer,
    );

    const program = E.scoped(
      E.gen(function* () {
        const httpServer = yield* HttpServer.HttpServer;
        const baseUrl = getHttpUrl(httpServer.address);

        const getAbility = getAbilityBase(baseUrl);

        const result = yield* getAbility({
          id: ABILITY_ID,
        });

        expect(result).toEqual(ability);
      }).pipe(E.provide(TestLive)),
    );

    await runTest(program);
  });

  test("returns NotFound when an ability does not exist", async () => {
    const abilityApiServiceMock = makeAbilityApiServiceMock();

    const TestLive = Layer.mergeAll(
      makeApiServerTestLayerWith(abilityApiServiceMock),
      FetchHttpClient.layer,
    );

    const program = E.scoped(
      E.gen(function* () {
        const httpServer = yield* HttpServer.HttpServer;
        const baseUrl = getHttpUrl(httpServer.address);

        const getAbility = getAbilityBase(baseUrl);

        const wasNotFound = yield* getAbility({
          id: UNKNOWN_ABILITY_ID,
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
