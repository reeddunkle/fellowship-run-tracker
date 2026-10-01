import * as Data from "effect/Data";
import * as E from "effect/Effect";
import * as FetchHttpClient from "effect/http/FetchHttpClient";
import * as HttpClient from "effect/http/HttpClient";
import * as HttpClientRequest from "effect/http/HttpClientRequest";
import type * as HttpClientResponse from "effect/http/HttpClientResponse";
import * as HttpServer from "effect/http/HttpServer";
import * as HttpApiClient from "effect/http-api/HttpApiClient";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { describe, expect, test } from "vitest";

import { getBaseUrl } from "@frt/api/tests/common/get-base-url.ts";
import { makeApiServerTestLayerWith } from "@frt/api/tests/common/layers/api-server-test-layer.ts";
import {
  type MakeConfigurationLibraryMockOptions,
  makeConfigurationLibraryMock,
} from "@frt/api/tests/common/mocks/configuration-library-mock.ts";
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

type ConfigurationRouteContext = {
  readonly baseUrl: string;
  readonly urls: HttpApiClient.UrlBuilder<typeof AppHttpApi>;
};

const UnknownFromJsonStringSchema = Schema.fromJsonString(Schema.Unknown);

const INVALID_REQUEST_BODY = {
  invalid: true,
};

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

function requestWithDecodedBody<A>(
  url: string,
  schema: Schema.Decoder<A>,
  options: RequestOptions = {},
) {
  return E.gen(function* () {
    const response = yield* request(url, options);
    const json = yield* parseResponseJson(response);
    const body = yield* Schema.decodeUnknownEffect(schema)(json);

    return {
      body,
      status: response.status,
    };
  });
}

function requestWithTextBody(url: string, options: RequestOptions = {}) {
  return E.gen(function* () {
    const response = yield* request(url, options);
    const text = yield* response.text;

    return {
      status: response.status,
      text,
    };
  });
}

function runWithConfigurationLibrary<A, Error>(
  serviceOptions: MakeConfigurationLibraryMockOptions,
  program: (
    context: ConfigurationRouteContext,
  ) => E.Effect<A, Error, HttpClient.HttpClient>,
) {
  return E.gen(function* () {
    const httpServer = yield* HttpServer.HttpServer;
    const baseUrl = getBaseUrl(httpServer.address);

    const urls = HttpApiClient.urlBuilder(AppHttpApi, {
      baseUrl,
    });

    return yield* program({
      baseUrl,
      urls,
    });
  }).pipe(
    E.scoped,
    E.provide(
      Layer.mergeAll(
        makeApiServerTestLayerWith(
          makeConfigurationLibraryMock(serviceOptions),
        ),
        FetchHttpClient.layer,
      ),
    ),
    runTest,
  );
}

describe("configuration routes", () => {
  test("GET /configurations returns all configurations", async () => {
    const { body, status } = await runWithConfigurationLibrary(
      {
        getAll: () => {
          return E.succeed([MOCK_CONFIGURATION]);
        },
      },
      ({ urls }) => {
        return requestWithDecodedBody(
          urls.configurations.getConfigurations(),
          ConfigurationApiConfigurationListSchema,
        );
      },
    );

    expect(status).toBe(200);
    expect(body).toEqual([MOCK_CONFIGURATION]);
  });

  test("GET /configurations/:id returns a configuration", async () => {
    const { body, status } = await runWithConfigurationLibrary(
      {
        getById: ({ id }) => {
          if (id === MOCK_CONFIGURATION_ID) {
            return E.succeedSome(MOCK_CONFIGURATION);
          }

          return E.succeedNone;
        },
      },
      ({ urls }) => {
        return requestWithDecodedBody(
          urls.configurations.getConfiguration({
            params: {
              id: MOCK_CONFIGURATION_ID,
            },
          }),
          ConfigurationApiConfigurationSchema,
        );
      },
    );

    expect(status).toBe(200);
    expect(body).toEqual(MOCK_CONFIGURATION);
  });

  test("GET /configurations/:id returns 404 when the configuration does not exist", async () => {
    const { status, text } = await runWithConfigurationLibrary(
      {},
      ({ urls }) => {
        return requestWithTextBody(
          urls.configurations.getConfiguration({
            params: {
              id: MOCK_UNKNOWN_CONFIGURATION_ID,
            },
          }),
        );
      },
    );

    expect(status).toBe(404);
    expect(text).toBe("");
  });

  test("POST /configurations saves a configuration", async () => {
    const { body, status } = await runWithConfigurationLibrary(
      {
        save: ({ configuration: savedConfiguration, label }) => {
          expect(savedConfiguration).toEqual({
            dungeonId: MOCK_SAVE_CONFIGURATION_REQUEST.configuration.dungeonId,
            dungeonLevel:
              MOCK_SAVE_CONFIGURATION_REQUEST.configuration.dungeonLevel,
            milestones:
              MOCK_SAVE_CONFIGURATION_REQUEST.configuration.milestones,
          });

          expect(label).toBe(MOCK_CONFIGURATION_LABEL);

          return E.succeed(MOCK_CONFIGURATION);
        },
      },
      ({ urls }) => {
        return requestWithDecodedBody(
          urls.configurations.saveConfiguration(),
          ConfigurationApiConfigurationSchema,
          {
            body: MOCK_SAVE_CONFIGURATION_REQUEST,
            method: "POST",
          },
        );
      },
    );

    expect(status).toBe(201);
    expect(body).toEqual(MOCK_CONFIGURATION);
    expect(body.fingerprint).toBe(MOCK_CONFIGURATION_FINGERPRINT);
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

    const { body, status } = await runWithConfigurationLibrary(
      {
        update: ({ configuration, id, label }) => {
          expect(id).toBe(MOCK_CONFIGURATION_ID);
          expect(configuration).toEqual(updatedRequest.configuration);
          expect(label).toBe(MOCK_UPDATED_CONFIGURATION_LABEL);

          return E.succeed(updatedConfiguration);
        },
      },
      ({ urls }) => {
        return requestWithDecodedBody(
          urls.configurations.updateConfiguration({
            params: {
              id: MOCK_CONFIGURATION_ID,
            },
          }),
          ConfigurationApiConfigurationSchema,
          {
            body: updatedRequest,
            method: "PUT",
          },
        );
      },
    );

    expect(status).toBe(200);
    expect(body).toEqual(updatedConfiguration);
  });

  test("DELETE /configurations/:id deletes a configuration", async () => {
    let deletedConfigurationId: string | undefined;

    const { status, text } = await runWithConfigurationLibrary(
      {
        delete: ({ id }) => {
          deletedConfigurationId = id;

          return E.void;
        },
      },
      ({ urls }) => {
        return requestWithTextBody(
          urls.configurations.deleteConfiguration({
            params: {
              id: MOCK_CONFIGURATION_ID,
            },
          }),
          {
            method: "DELETE",
          },
        );
      },
    );

    expect(status).toBe(204);
    expect(deletedConfigurationId).toBe(MOCK_CONFIGURATION_ID);
    expect(text).toBe("");
  });

  describe("invalid request bodies", () => {
    function sendInvalidBody(
      getUrl: (urls: ConfigurationRouteContext["urls"]) => string,
      method: HttpClientRequest.HttpClientRequest["method"],
    ) {
      return runWithConfigurationLibrary({}, ({ urls }) => {
        return requestWithTextBody(getUrl(urls), {
          body: INVALID_REQUEST_BODY,
          method,
        });
      });
    }

    test("POST /configurations returns 400", async () => {
      const { status, text } = await sendInvalidBody((urls) => {
        return urls.configurations.saveConfiguration();
      }, "POST");

      expect(status).toBe(400);
      expect(text).toBe("");
    });

    test("PUT /configurations/:id returns 400", async () => {
      const { status, text } = await sendInvalidBody((urls) => {
        return urls.configurations.updateConfiguration({
          params: {
            id: MOCK_CONFIGURATION_ID,
          },
        });
      }, "PUT");

      expect(status).toBe(400);
      expect(text).toBe("");
    });
  });

  test("returns 400 for a malformed configuration id", async () => {
    const { status, text } = await runWithConfigurationLibrary(
      {},
      ({ baseUrl }) => {
        return requestWithTextBody(`${baseUrl}/configurations/not-a-uuid`);
      },
    );

    expect(status).toBe(400);
    expect(text).toBe("");
  });

  test("returns 500 when loading configurations fails", async () => {
    const { status, text } = await runWithConfigurationLibrary(
      {
        getAll: () => {
          return E.fail(
            new ConfigurationDAOError({
              reason: new UnexpectedDatabaseError({
                cause: new Error("Database failure."),
              }),
            }),
          );
        },
      },
      ({ urls }) => {
        return requestWithTextBody(urls.configurations.getConfigurations());
      },
    );

    expect(status).toBe(500);
    expect(text).toBe("");
  });
});
