import * as Data from "effect/Data";
import * as E from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import * as FetchHttpClient from "effect/unstable/http/FetchHttpClient";
import * as HttpClient from "effect/unstable/http/HttpClient";
import * as HttpClientRequest from "effect/unstable/http/HttpClientRequest";
import type * as HttpClientResponse from "effect/unstable/http/HttpClientResponse";
import * as HttpServer from "effect/unstable/http/HttpServer";
import * as HttpApiClient from "effect/unstable/httpapi/HttpApiClient";
import { describe, expect, test } from "vitest";

import { makeApiServerTestLayerWith } from "@frt/api/tests/common/layers/api-server-test-layer.ts";
import { makeConfigurationLibraryMock } from "@frt/api/tests/common/mocks/configuration-library-mock.ts";
import { runTest } from "@frt/api/tests/common/run-test.ts";
import { AppHttpApi } from "@frt/api-contract/http/http-api.ts";
import { ConfigurationDAOError } from "@frt/db/errors/configuration-dao-error.ts";
import { UnexpectedDatabaseError } from "@frt/db/errors/unexpected-database-error.ts";
import {
  MOCK_CONFIGURATION,
  MOCK_CONFIGURATION_FINGERPRINT,
  MOCK_CONFIGURATION_ID,
  MOCK_CONFIGURATION_LABEL,
  MOCK_SAVE_CONFIGURATION_REQUEST,
  MOCK_UNKNOWN_CONFIGURATION_ID,
  MOCK_UPDATED_CONFIGURATION_LABEL,
} from "@frt/db/tests/common/fixtures/configuration-fixtures.ts";
import {
  type ConfigurationApiConfiguration,
  ConfigurationApiConfigurationListSchema,
  ConfigurationApiConfigurationSchema,
} from "@frt/shared/configuration/configuration-api-schema.ts";
import { parseJson } from "@frt/shared/util/parse-json.ts";

class HttpRequestError extends Data.TaggedError("HttpRequestError")<{
  readonly cause: unknown;
}> {
  override get message() {
    return "The HTTP request failed.";
  }
}

class HttpResponseReadError extends Data.TaggedError("HttpResponseReadError")<{
  readonly cause: unknown;
}> {
  override get message() {
    return "Failed to read the HTTP response body.";
  }
}

class HttpResponseParseError extends Data.TaggedError(
  "HttpResponseParseError",
)<{
  readonly cause: unknown;
}> {
  override get message() {
    return "Failed to parse the HTTP response body as JSON.";
  }
}

type RequestOptions = {
  readonly body?: unknown;
  readonly method?: HttpClientRequest.HttpClientRequest["method"];
};

const UnknownFromJsonStringSchema = Schema.fromJsonString(Schema.Unknown);

function parseResponseJson(
  response: HttpClientResponse.HttpClientResponse,
): E.Effect<unknown, HttpResponseReadError | HttpResponseParseError> {
  return E.gen(function* () {
    const contents = yield* response.text.pipe(
      E.mapError((cause) => {
        return new HttpResponseReadError({
          cause,
        });
      }),
    );

    return yield* parseJson({
      contents,
      onError: (cause) => {
        return new HttpResponseParseError({
          cause,
        });
      },
    });
  });
}

function getHttpUrl(address: HttpServer.Address): string {
  if (address._tag === "UnixAddress") {
    throw new Error("HTTP test does not support Unix socket addresses.");
  }

  const hostname =
    address.hostname === "0.0.0.0" ? "127.0.0.1" : address.hostname;

  return `http://${hostname}:${address.port}`;
}

function request(
  url: string,
  options: RequestOptions = {},
): E.Effect<
  HttpClientResponse.HttpClientResponse,
  HttpRequestError | Schema.SchemaError,
  HttpClient.HttpClient
> {
  return E.gen(function* () {
    const httpClient = yield* HttpClient.HttpClient;
    const method = options.method ?? "GET";

    const httpRequest =
      options.body === undefined
        ? HttpClientRequest.make(method)(url)
        : HttpClientRequest.make(method)(url).pipe(
            HttpClientRequest.bodyText(
              yield* Schema.encodeEffect(UnknownFromJsonStringSchema)(
                options.body,
              ),
              "application/json",
            ),
          );

    return yield* httpClient.execute(httpRequest).pipe(
      E.mapError((cause) => {
        return new HttpRequestError({
          cause,
        });
      }),
    );
  });
}

describe("configuration routes", () => {
  test("GET /configurations returns all configurations", async () => {
    const configurationLibraryMock = makeConfigurationLibraryMock({
      getAll: () => {
        return E.succeed([MOCK_CONFIGURATION]);
      },
    });

    const program = E.scoped(
      E.gen(function* () {
        const httpServer = yield* HttpServer.HttpServer;
        const baseUrl = getHttpUrl(httpServer.address);

        const urls = HttpApiClient.urlBuilder(AppHttpApi, {
          baseUrl,
        });

        const response = yield* request(
          urls.configurations.getConfigurations(),
        );

        const json = yield* parseResponseJson(response);

        const body = yield* Schema.decodeUnknownEffect(
          ConfigurationApiConfigurationListSchema,
        )(json);

        expect(response.status).toBe(200);
        expect(body).toEqual([MOCK_CONFIGURATION]);
      }).pipe(
        E.provide(
          Layer.mergeAll(
            makeApiServerTestLayerWith(configurationLibraryMock),
            FetchHttpClient.layer,
          ),
        ),
      ),
    );

    await runTest(program);
  });

  test("GET /configurations/:id returns a configuration", async () => {
    const configurationLibraryMock = makeConfigurationLibraryMock({
      getById: ({ id }) => {
        if (id === MOCK_CONFIGURATION_ID) {
          return E.succeedSome(MOCK_CONFIGURATION);
        }

        return E.succeedNone;
      },
    });

    const program = E.scoped(
      E.gen(function* () {
        const httpServer = yield* HttpServer.HttpServer;
        const baseUrl = getHttpUrl(httpServer.address);

        const urls = HttpApiClient.urlBuilder(AppHttpApi, {
          baseUrl,
        });

        const response = yield* request(
          urls.configurations.getConfiguration({
            params: {
              id: MOCK_CONFIGURATION_ID,
            },
          }),
        );

        const json = yield* parseResponseJson(response);

        const body = yield* Schema.decodeUnknownEffect(
          ConfigurationApiConfigurationSchema,
        )(json);

        expect(response.status).toBe(200);
        expect(body).toEqual(MOCK_CONFIGURATION);
      }).pipe(
        E.provide(
          Layer.mergeAll(
            makeApiServerTestLayerWith(configurationLibraryMock),
            FetchHttpClient.layer,
          ),
        ),
      ),
    );

    await runTest(program);
  });

  test("GET /configurations/:id returns 404 when the configuration does not exist", async () => {
    const configurationLibraryMock = makeConfigurationLibraryMock();

    const program = E.scoped(
      E.gen(function* () {
        const httpServer = yield* HttpServer.HttpServer;
        const baseUrl = getHttpUrl(httpServer.address);

        const urls = HttpApiClient.urlBuilder(AppHttpApi, {
          baseUrl,
        });

        const response = yield* request(
          urls.configurations.getConfiguration({
            params: {
              id: MOCK_UNKNOWN_CONFIGURATION_ID,
            },
          }),
        );

        expect(response.status).toBe(404);
        expect(yield* response.text).toBe("");
      }).pipe(
        E.provide(
          Layer.mergeAll(
            makeApiServerTestLayerWith(configurationLibraryMock),
            FetchHttpClient.layer,
          ),
        ),
      ),
    );

    await runTest(program);
  });

  test("POST /configurations saves a configuration", async () => {
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

    const program = E.scoped(
      E.gen(function* () {
        const httpServer = yield* HttpServer.HttpServer;
        const baseUrl = getHttpUrl(httpServer.address);

        const urls = HttpApiClient.urlBuilder(AppHttpApi, {
          baseUrl,
        });

        const response = yield* request(
          urls.configurations.saveConfiguration(),
          {
            body: MOCK_SAVE_CONFIGURATION_REQUEST,
            method: "POST",
          },
        );

        const json = yield* parseResponseJson(response);

        const body = yield* Schema.decodeUnknownEffect(
          ConfigurationApiConfigurationSchema,
        )(json);

        expect(response.status).toBe(201);
        expect(body).toEqual(MOCK_CONFIGURATION);
        expect(body.fingerprint).toBe(MOCK_CONFIGURATION_FINGERPRINT);
      }).pipe(
        E.provide(
          Layer.mergeAll(
            makeApiServerTestLayerWith(configurationLibraryMock),
            FetchHttpClient.layer,
          ),
        ),
      ),
    );

    await runTest(program);
  });

  test("POST /configurations updates a semantically duplicate configuration", async () => {
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

    const program = E.scoped(
      E.gen(function* () {
        const httpServer = yield* HttpServer.HttpServer;
        const baseUrl = getHttpUrl(httpServer.address);

        const urls = HttpApiClient.urlBuilder(AppHttpApi, {
          baseUrl,
        });

        const response = yield* request(
          urls.configurations.saveConfiguration(),
          {
            body: updatedRequest,
            method: "POST",
          },
        );

        const json = yield* parseResponseJson(response);

        const body = yield* Schema.decodeUnknownEffect(
          ConfigurationApiConfigurationSchema,
        )(json);

        expect(response.status).toBe(201);
        expect(body.id).toBe(MOCK_CONFIGURATION_ID);
        expect(body.fingerprint).toBe(MOCK_CONFIGURATION_FINGERPRINT);
        expect(body.label).toBe(MOCK_UPDATED_CONFIGURATION_LABEL);
      }).pipe(
        E.provide(
          Layer.mergeAll(
            makeApiServerTestLayerWith(configurationLibraryMock),
            FetchHttpClient.layer,
          ),
        ),
      ),
    );

    await runTest(program);
  });

  test("POST /configurations returns 400 for an invalid request body", async () => {
    const configurationLibraryMock = makeConfigurationLibraryMock();

    const program = E.scoped(
      E.gen(function* () {
        const httpServer = yield* HttpServer.HttpServer;
        const baseUrl = getHttpUrl(httpServer.address);

        const urls = HttpApiClient.urlBuilder(AppHttpApi, {
          baseUrl,
        });

        const response = yield* request(
          urls.configurations.saveConfiguration(),
          {
            body: {
              invalid: true,
            },
            method: "POST",
          },
        );

        expect(response.status).toBe(400);
        expect(yield* response.text).toBe("");
      }).pipe(
        E.provide(
          Layer.mergeAll(
            makeApiServerTestLayerWith(configurationLibraryMock),
            FetchHttpClient.layer,
          ),
        ),
      ),
    );

    await runTest(program);
  });

  test("PUT /configurations/:id updates a configuration", async () => {
    const updatedConfiguration = {
      ...MOCK_CONFIGURATION,
      label: MOCK_UPDATED_CONFIGURATION_LABEL,
    } satisfies ConfigurationApiConfiguration;

    const updatedRequest = {
      ...MOCK_SAVE_CONFIGURATION_REQUEST,
      label: MOCK_UPDATED_CONFIGURATION_LABEL,
    } as const;

    const configurationLibraryMock = makeConfigurationLibraryMock({
      update: ({ configuration, id, label }) => {
        expect(id).toBe(MOCK_CONFIGURATION_ID);
        expect(configuration).toEqual(updatedRequest.configuration);
        expect(label).toBe(MOCK_UPDATED_CONFIGURATION_LABEL);

        return E.succeed(updatedConfiguration);
      },
    });

    const program = E.scoped(
      E.gen(function* () {
        const httpServer = yield* HttpServer.HttpServer;
        const baseUrl = getHttpUrl(httpServer.address);

        const urls = HttpApiClient.urlBuilder(AppHttpApi, {
          baseUrl,
        });

        const response = yield* request(
          urls.configurations.updateConfiguration({
            params: {
              id: MOCK_CONFIGURATION_ID,
            },
          }),
          {
            body: updatedRequest,
            method: "PUT",
          },
        );

        const json = yield* parseResponseJson(response);

        const body = yield* Schema.decodeUnknownEffect(
          ConfigurationApiConfigurationSchema,
        )(json);

        expect(response.status).toBe(200);
        expect(body).toEqual(updatedConfiguration);
        expect(body.id).toBe(MOCK_CONFIGURATION_ID);
        expect(body.label).toBe(MOCK_UPDATED_CONFIGURATION_LABEL);
      }).pipe(
        E.provide(
          Layer.mergeAll(
            makeApiServerTestLayerWith(configurationLibraryMock),
            FetchHttpClient.layer,
          ),
        ),
      ),
    );

    await runTest(program);
  });

  test("PUT /configurations/:id returns 400 for an invalid request body", async () => {
    const configurationLibraryMock = makeConfigurationLibraryMock();

    const program = E.scoped(
      E.gen(function* () {
        const httpServer = yield* HttpServer.HttpServer;
        const baseUrl = getHttpUrl(httpServer.address);

        const urls = HttpApiClient.urlBuilder(AppHttpApi, {
          baseUrl,
        });

        const response = yield* request(
          urls.configurations.updateConfiguration({
            params: {
              id: MOCK_CONFIGURATION_ID,
            },
          }),
          {
            body: {
              invalid: true,
            },
            method: "PUT",
          },
        );

        expect(response.status).toBe(400);
        expect(yield* response.text).toBe("");
      }).pipe(
        E.provide(
          Layer.mergeAll(
            makeApiServerTestLayerWith(configurationLibraryMock),
            FetchHttpClient.layer,
          ),
        ),
      ),
    );

    await runTest(program);
  });

  test("DELETE /configurations/:id deletes a configuration", async () => {
    let deletedConfigurationId: string | undefined;

    const configurationLibraryMock = makeConfigurationLibraryMock({
      delete: ({ id }) => {
        deletedConfigurationId = id;

        return E.void;
      },
    });

    const program = E.scoped(
      E.gen(function* () {
        const httpServer = yield* HttpServer.HttpServer;
        const baseUrl = getHttpUrl(httpServer.address);

        const urls = HttpApiClient.urlBuilder(AppHttpApi, {
          baseUrl,
        });

        const response = yield* request(
          urls.configurations.deleteConfiguration({
            params: {
              id: MOCK_CONFIGURATION_ID,
            },
          }),
          {
            method: "DELETE",
          },
        );

        expect(response.status).toBe(204);
        expect(deletedConfigurationId).toBe(MOCK_CONFIGURATION_ID);
        expect(yield* response.text).toBe("");
      }).pipe(
        E.provide(
          Layer.mergeAll(
            makeApiServerTestLayerWith(configurationLibraryMock),
            FetchHttpClient.layer,
          ),
        ),
      ),
    );

    await runTest(program);
  });

  test("returns 400 for a malformed configuration id", async () => {
    const configurationLibraryMock = makeConfigurationLibraryMock();

    const program = E.scoped(
      E.gen(function* () {
        const httpServer = yield* HttpServer.HttpServer;
        const baseUrl = getHttpUrl(httpServer.address);

        const response = yield* request(`${baseUrl}/configurations/not-a-uuid`);

        expect(response.status).toBe(400);
        expect(yield* response.text).toBe("");
      }).pipe(
        E.provide(
          Layer.mergeAll(
            makeApiServerTestLayerWith(configurationLibraryMock),
            FetchHttpClient.layer,
          ),
        ),
      ),
    );

    await runTest(program);
  });

  test("returns 404 for an unsupported method", async () => {
    const configurationLibraryMock = makeConfigurationLibraryMock();

    const program = E.scoped(
      E.gen(function* () {
        const httpServer = yield* HttpServer.HttpServer;
        const baseUrl = getHttpUrl(httpServer.address);

        const urls = HttpApiClient.urlBuilder(AppHttpApi, {
          baseUrl,
        });

        const response = yield* request(
          urls.configurations.getConfigurations(),
          {
            method: "PATCH",
          },
        );

        expect(response.status).toBe(404);
      }).pipe(
        E.provide(
          Layer.mergeAll(
            makeApiServerTestLayerWith(configurationLibraryMock),
            FetchHttpClient.layer,
          ),
        ),
      ),
    );

    await runTest(program);
  });

  test("returns 500 when loading configurations fails", async () => {
    const configurationLibraryMock = makeConfigurationLibraryMock({
      getAll: () => {
        return E.fail(
          new ConfigurationDAOError({
            reason: new UnexpectedDatabaseError({
              cause: new Error("Database failure."),
            }),
          }),
        );
      },
    });

    const program = E.scoped(
      E.gen(function* () {
        const httpServer = yield* HttpServer.HttpServer;
        const baseUrl = getHttpUrl(httpServer.address);

        const urls = HttpApiClient.urlBuilder(AppHttpApi, {
          baseUrl,
        });

        const response = yield* request(
          urls.configurations.getConfigurations(),
        );

        expect(response.status).toBe(500);
        expect(yield* response.text).toBe("");
      }).pipe(
        E.provide(
          Layer.mergeAll(
            makeApiServerTestLayerWith(configurationLibraryMock),
            FetchHttpClient.layer,
          ),
        ),
      ),
    );

    await runTest(program);
  });
});
