import * as E from "effect/Effect";
import { describe, expect, test } from "vitest";

import { makeApiServerTestLayerWith } from "@frt/api/tests/common/layers/api-server-test-layer.ts";
import { makeConfigurationLibraryMock } from "@frt/api/tests/common/mocks/configuration-library-mock.ts";
import {
  MOCK_CONFIGURATION,
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
import { runWithTestApiServer } from "@/tests/browser/common/run-with-test-api-server.ts";

const UPDATED_CONFIGURATION = {
  ...MOCK_CONFIGURATION,
  label: MOCK_UPDATED_CONFIGURATION_LABEL,
} satisfies ConfigurationApiConfiguration;

const UPDATED_REQUEST = {
  ...MOCK_SAVE_CONFIGURATION_REQUEST,
  label: MOCK_UPDATED_CONFIGURATION_LABEL,
} as const;

function makeRecordingApiServer() {
  const receivedCalls: Array<unknown> = [];

  const layer = makeApiServerTestLayerWith(
    makeConfigurationLibraryMock({
      delete: ({ id }) => {
        receivedCalls.push({ id, method: "delete" });

        return E.void;
      },
      getAll: () => {
        return E.succeed([MOCK_CONFIGURATION]);
      },
      getById: ({ id }) => {
        return id === MOCK_CONFIGURATION_ID
          ? E.succeedSome(MOCK_CONFIGURATION)
          : E.succeedNone;
      },
      save: ({ configuration, label }) => {
        receivedCalls.push({ configuration, label, method: "save" });

        return E.succeed(MOCK_CONFIGURATION);
      },
      update: ({ configuration, id, label }) => {
        receivedCalls.push({ configuration, id, label, method: "update" });

        return E.succeed(UPDATED_CONFIGURATION);
      },
    }),
  );

  return { layer, receivedCalls };
}

describe("configuration client", () => {
  test("gets all configurations", async () => {
    const { layer } = makeRecordingApiServer();

    const configurations = await runWithTestApiServer(
      getConfigurations(),
      layer,
    );

    expect(configurations).toEqual([MOCK_CONFIGURATION]);
  });

  test("gets a configuration", async () => {
    const { layer } = makeRecordingApiServer();

    const configuration = await runWithTestApiServer(
      getConfiguration({ id: MOCK_CONFIGURATION_ID }),
      layer,
    );

    expect(configuration).toEqual(MOCK_CONFIGURATION);
  });

  test("returns NotFound when a configuration does not exist", async () => {
    const { layer } = makeRecordingApiServer();

    const error = await runWithTestApiServer(
      getConfiguration({ id: MOCK_UNKNOWN_CONFIGURATION_ID }).pipe(E.flip),
      layer,
    );

    expect(error._tag).toBe("NotFound");
  });

  test("saves a configuration", async () => {
    const { layer, receivedCalls } = makeRecordingApiServer();

    const configuration = await runWithTestApiServer(
      saveConfiguration({ request: MOCK_SAVE_CONFIGURATION_REQUEST }),
      layer,
    );

    expect(configuration).toEqual(MOCK_CONFIGURATION);
    expect(receivedCalls).toEqual([
      {
        configuration: MOCK_SAVE_CONFIGURATION_REQUEST.configuration,
        label: MOCK_CONFIGURATION_LABEL,
        method: "save",
      },
    ]);
  });

  test("updates a configuration", async () => {
    const { layer, receivedCalls } = makeRecordingApiServer();

    const configuration = await runWithTestApiServer(
      updateConfiguration({
        id: MOCK_CONFIGURATION_ID,
        request: UPDATED_REQUEST,
      }),
      layer,
    );

    expect(configuration).toEqual(UPDATED_CONFIGURATION);
    expect(receivedCalls).toEqual([
      {
        configuration: UPDATED_REQUEST.configuration,
        id: MOCK_CONFIGURATION_ID,
        label: MOCK_UPDATED_CONFIGURATION_LABEL,
        method: "update",
      },
    ]);
  });

  test("deletes a configuration", async () => {
    const { layer, receivedCalls } = makeRecordingApiServer();

    await runWithTestApiServer(
      deleteConfiguration({ id: MOCK_CONFIGURATION_ID }),
      layer,
    );

    expect(receivedCalls).toEqual([
      { id: MOCK_CONFIGURATION_ID, method: "delete" },
    ]);
  });
});
