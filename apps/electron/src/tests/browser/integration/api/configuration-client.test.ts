import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Result from "effect/Result";
import { describe, expect, test } from "vitest";

import { makeApiServerTestLayerWith } from "@frt/api/tests/common/layers/api-server-test-layer.ts";
import { makeConfigurationLibraryMock } from "@frt/api/tests/common/mocks/configuration-library-mock.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import {
  MOCK_CONFIGURATION,
  MOCK_CONFIGURATION_FINGERPRINT,
  MOCK_CONFIGURATION_ID,
  MOCK_CONFIGURATION_LABEL,
  MOCK_SAVE_CONFIGURATION_REQUEST,
  MOCK_UNKNOWN_CONFIGURATION_ID,
  MOCK_UPDATED_CONFIGURATION_LABEL,
} from "@frt/db/tests/common/fixtures/configuration-fixtures.ts";
import { type ConfigurationApiConfiguration } from "@frt/shared/configuration/configuration-api-schema.ts";

import {
  deleteConfiguration,
  getConfiguration,
  getConfigurations,
  saveConfiguration,
  updateConfiguration,
} from "@/renderer/api/configuration/configuration-client.ts";
import { TestAppApiClientTestLive } from "@/tests/browser/common/layers/app-api-client-test-layer.ts";

describe("configuration client", () => {
  test("gets all configurations", async () => {
    const configurationLibraryMock = makeConfigurationLibraryMock({
      getAll: () => {
        return E.succeed([MOCK_CONFIGURATION]);
      },
    });

    const ApiServerTestLive = makeApiServerTestLayerWith(
      configurationLibraryMock,
    );

    const TestLive = TestAppApiClientTestLive.pipe(
      Layer.provide(ApiServerTestLive),
    );

    const program = E.scoped(
      E.gen(function* () {
        const configurations = yield* getConfigurations();

        expect(configurations).toEqual([MOCK_CONFIGURATION]);
      }).pipe(E.provide(TestLive)),
    );

    await runTest(program);
  });

  test("gets a configuration", async () => {
    const configurationLibraryMock = makeConfigurationLibraryMock({
      getById: ({ id }) => {
        if (id === MOCK_CONFIGURATION_ID) {
          return E.succeedSome(MOCK_CONFIGURATION);
        }

        return E.succeedNone;
      },
    });

    const ApiServerTestLive = makeApiServerTestLayerWith(
      configurationLibraryMock,
    );

    const TestLive = TestAppApiClientTestLive.pipe(
      Layer.provide(ApiServerTestLive),
    );

    const program = E.scoped(
      E.gen(function* () {
        const result = yield* getConfiguration({
          id: MOCK_CONFIGURATION_ID,
        });

        expect(result).toEqual(MOCK_CONFIGURATION);
      }).pipe(E.provide(TestLive)),
    );

    await runTest(program);
  });

  test("returns NotFound when a configuration does not exist", async () => {
    const configurationLibraryMock = makeConfigurationLibraryMock();

    const ApiServerTestLive = makeApiServerTestLayerWith(
      configurationLibraryMock,
    );

    const TestLive = TestAppApiClientTestLive.pipe(
      Layer.provide(ApiServerTestLive),
    );

    const program = E.scoped(
      E.gen(function* () {
        const result = yield* getConfiguration({
          id: MOCK_UNKNOWN_CONFIGURATION_ID,
        }).pipe(E.result);

        expect(Result.isFailure(result)).toBe(true);

        if (Result.isFailure(result)) {
          expect(result.failure._tag).toBe("NotFound");
        }
      }).pipe(E.provide(TestLive)),
    );

    await runTest(program);
  });

  test("saves a configuration", async () => {
    const configurationLibraryMock = makeConfigurationLibraryMock({
      save: ({ configuration: savedConfiguration, label }) => {
        expect(savedConfiguration).toEqual({
          dungeonId: MOCK_SAVE_CONFIGURATION_REQUEST.configuration.dungeonId,
          dungeonLevel:
            MOCK_SAVE_CONFIGURATION_REQUEST.configuration.dungeonLevel,
          milestones: MOCK_SAVE_CONFIGURATION_REQUEST.configuration.milestones,
        });

        expect(label).toBe(MOCK_CONFIGURATION_LABEL);

        return E.succeed(MOCK_CONFIGURATION);
      },
    });

    const ApiServerTestLive = makeApiServerTestLayerWith(
      configurationLibraryMock,
    );

    const TestLive = TestAppApiClientTestLive.pipe(
      Layer.provide(ApiServerTestLive),
    );

    const program = E.scoped(
      E.gen(function* () {
        const result = yield* saveConfiguration({
          request: MOCK_SAVE_CONFIGURATION_REQUEST,
        });

        expect(result).toEqual(MOCK_CONFIGURATION);
        expect(result.fingerprint).toBe(MOCK_CONFIGURATION_FINGERPRINT);
      }).pipe(E.provide(TestLive)),
    );

    await runTest(program);
  });

  test("saves a semantically duplicate configuration as an update", async () => {
    const updatedConfiguration = {
      ...MOCK_CONFIGURATION,
      label: MOCK_UPDATED_CONFIGURATION_LABEL,
    } satisfies ConfigurationApiConfiguration;

    const updatedRequest = {
      ...MOCK_SAVE_CONFIGURATION_REQUEST,
      label: MOCK_UPDATED_CONFIGURATION_LABEL,
    } as const;

    const configurationLibraryMock = makeConfigurationLibraryMock({
      save: ({ configuration: savedConfiguration, label }) => {
        expect(savedConfiguration).toEqual(updatedRequest.configuration);
        expect(label).toBe(MOCK_UPDATED_CONFIGURATION_LABEL);

        return E.succeed(updatedConfiguration);
      },
    });

    const ApiServerTestLive = makeApiServerTestLayerWith(
      configurationLibraryMock,
    );

    const TestLive = TestAppApiClientTestLive.pipe(
      Layer.provide(ApiServerTestLive),
    );

    const program = E.scoped(
      E.gen(function* () {
        const result = yield* saveConfiguration({
          request: updatedRequest,
        });

        expect(result.id).toBe(MOCK_CONFIGURATION_ID);
        expect(result.fingerprint).toBe(MOCK_CONFIGURATION_FINGERPRINT);
        expect(result.label).toBe(MOCK_UPDATED_CONFIGURATION_LABEL);
      }).pipe(E.provide(TestLive)),
    );

    await runTest(program);
  });

  test("updates a configuration", async () => {
    const updatedConfiguration = {
      ...MOCK_CONFIGURATION,
      label: MOCK_UPDATED_CONFIGURATION_LABEL,
    } satisfies ConfigurationApiConfiguration;

    const updatedRequest = {
      ...MOCK_SAVE_CONFIGURATION_REQUEST,
      label: MOCK_UPDATED_CONFIGURATION_LABEL,
    } as const;

    const configurationLibraryMock = makeConfigurationLibraryMock({
      update: ({ configuration: updatedValue, id, label }) => {
        expect(id).toBe(MOCK_CONFIGURATION_ID);
        expect(updatedValue).toEqual(updatedRequest.configuration);
        expect(label).toBe(MOCK_UPDATED_CONFIGURATION_LABEL);

        return E.succeed(updatedConfiguration);
      },
    });

    const ApiServerTestLive = makeApiServerTestLayerWith(
      configurationLibraryMock,
    );

    const TestLive = TestAppApiClientTestLive.pipe(
      Layer.provide(ApiServerTestLive),
    );

    const program = E.scoped(
      E.gen(function* () {
        const result = yield* updateConfiguration({
          id: MOCK_CONFIGURATION_ID,
          request: updatedRequest,
        });

        expect(result).toEqual(updatedConfiguration);
        expect(result.id).toBe(MOCK_CONFIGURATION_ID);
        expect(result.label).toBe(MOCK_UPDATED_CONFIGURATION_LABEL);
      }).pipe(E.provide(TestLive)),
    );

    await runTest(program);
  });

  test("deletes a configuration", async () => {
    let deletedConfigurationId: string | undefined;

    const configurationLibraryMock = makeConfigurationLibraryMock({
      delete: ({ id }) => {
        deletedConfigurationId = id;

        return E.void;
      },
    });

    const ApiServerTestLive = makeApiServerTestLayerWith(
      configurationLibraryMock,
    );

    const TestLive = TestAppApiClientTestLive.pipe(
      Layer.provide(ApiServerTestLive),
    );

    const program = E.scoped(
      E.gen(function* () {
        yield* deleteConfiguration({
          id: MOCK_CONFIGURATION_ID,
        });

        expect(deletedConfigurationId).toBe(MOCK_CONFIGURATION_ID);
      }).pipe(E.provide(TestLive)),
    );

    await runTest(program);
  });
});
