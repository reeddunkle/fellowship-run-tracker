import { Buffer } from "node:buffer";
// @effect-diagnostics-next-line nodeBuiltinImport:off
import { createServer } from "node:http";

import * as Console from "effect/Console";
import * as Command from "effect/cli/Command";
import * as Flag from "effect/cli/Flag";
import * as Data from "effect/Data";
import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as FileSystem from "effect/FileSystem";
import { HttpClient, HttpClientRequest } from "effect/http";
import * as Option from "effect/Option";
import * as Path from "effect/Path";
import * as Redacted from "effect/Redacted";

import { appConfig } from "@frt/api/app-config.ts";
import { NodeHttpClientLayer } from "@frt/api/layers/node-platform-layer.ts";
import {
  buildAuthorizationUrl,
  deriveCodeChallenge,
  generateCodeVerifier,
  generateOAuthState,
} from "@frt/api/services/fellowship-logs-authorization/fellowship-logs-pkce.ts";
import { FELLOWSHIP_LOGS_TOKEN_URL } from "@frt/api/services/fellowship-logs-oauth-client/fellowship-logs-oauth-urls.ts";
import { FellowshipLogsConfiguredRedirectUriSchema } from "@frt/api/validation/fellowship-logs-oauth-config-schema.ts";
import {
  type FellowshipLogsRedirectUri,
  FellowshipLogsRedirectUriSchema,
} from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";

const FELLOWSHIP_LOGS_USER_API_URL =
  "https://www.fellowshiplogs.com/api/v2/user";
const CALLBACK_TIMEOUT = "5 minutes";
const DEFAULT_REDIRECT_URI = "http://127.0.0.1:47892/oauth/callback";
const REPORT_DIRECTORY = "data/fellowship-logs-oauth-probe";
const SAFE_ERROR_FIELDS = ["error", "error_description", "hint", "message"];
const LEAF_TYPE_KINDS = new Set(["ENUM", "SCALAR"]);

const TYPE_REF_SELECTION =
  "name kind ofType { name kind ofType { name kind ofType { name kind } } }";
const FIELD_SELECTION = `fields { name args { name } type { ${TYPE_REF_SELECTION} } }`;

const INTROSPECTION_QUERY = `
  query ProbeSchema {
    user: __type(name: "User") { ${FIELD_SELECTION} }
    userData: __type(name: "UserData") { ${FIELD_SELECTION} }
    rateLimitData: __type(name: "RateLimitData") { ${FIELD_SELECTION} }
  }
`;

const IDENTITY_QUERY = `
  query ProbeIdentity {
    userData { currentUser { id name } }
  }
`;

const ACCESS_TOKEN_CHECK_QUERY =
  "query ProbeAccessToken { rateLimitData { pointsSpentThisHour } }";

class FellowshipLogsOAuthProbeError extends Data.TaggedError(
  "FellowshipLogsOAuthProbeError",
)<{
  readonly cause?: unknown;
  readonly message: string;
}> {}

type JsonRecord = Readonly<Record<string, unknown>>;

type HttpResult = {
  readonly body: unknown;
  readonly contentType: string | null;
  readonly status: number;
};

type IntrospectedField = {
  readonly hasArguments: boolean;
  readonly name: string;
  readonly namedType: { readonly kind: string; readonly name: string } | null;
  readonly type: string;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function pickSafeErrorFields(body: unknown) {
  if (!isRecord(body)) {
    return { bodyType: typeof body };
  }

  return {
    fields: Object.keys(body).toSorted(),
    ...Object.fromEntries(
      SAFE_ERROR_FIELDS.filter((field) => Object.hasOwn(body, field)).map(
        (field) => [field, body[field]],
      ),
    ),
  };
}

function stringifyJson(value: unknown, space?: number) {
  return JSON.stringify(value, null, space);
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

function describeToken(token: unknown) {
  if (typeof token !== "string") {
    return null;
  }

  const segments = token.split(".");
  const [, payloadSegment] = segments;

  if (segments.length !== 3 || payloadSegment === undefined) {
    return { kind: "opaque", length: token.length };
  }

  const payload = parseJson(
    Buffer.from(payloadSegment, "base64url").toString("utf8"),
  );

  if (!isRecord(payload)) {
    return { kind: "jwt-unreadable" };
  }

  return {
    claimNames: Object.keys(payload).toSorted(),
    kind: "jwt",
    lifetimeSeconds:
      typeof payload.exp === "number" && typeof payload.iat === "number"
        ? payload.exp - payload.iat
        : null,
    scopes: payload.scopes ?? payload.scope ?? null,
  };
}

function describeTokenResponse(result: HttpResult) {
  if (result.status !== 200 || !isRecord(result.body)) {
    return {
      contentType: result.contentType,
      error: pickSafeErrorFields(result.body),
      status: result.status,
    };
  }

  return {
    accessToken: describeToken(result.body.access_token),
    contentType: result.contentType,
    expiresIn: result.body.expires_in ?? null,
    fields: Object.keys(result.body).toSorted(),
    refreshToken: describeToken(result.body.refresh_token),
    scope: result.body.scope ?? null,
    status: result.status,
    tokenType: result.body.token_type ?? null,
  };
}

function getStringField(body: unknown, field: string) {
  return isRecord(body) && typeof body[field] === "string"
    ? Redacted.make(body[field])
    : null;
}

function describeValueTypes(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(describeValueTypes);
  }

  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        describeValueTypes(entry),
      ]),
    );
  }

  return value === null ? "null" : typeof value;
}

function getData(body: unknown, field: string) {
  return isRecord(body) && isRecord(body.data)
    ? (body.data[field] ?? null)
    : null;
}

function formatTypeRef(typeRef: unknown): string {
  if (!isRecord(typeRef)) {
    return "?";
  }

  if (typeRef.kind === "NON_NULL") {
    return `${formatTypeRef(typeRef.ofType)}!`;
  }

  if (typeRef.kind === "LIST") {
    return `[${formatTypeRef(typeRef.ofType)}]`;
  }

  return typeof typeRef.name === "string" ? typeRef.name : "?";
}

function getNamedType(typeRef: unknown): IntrospectedField["namedType"] {
  if (!isRecord(typeRef)) {
    return null;
  }

  if (typeof typeRef.name === "string" && typeof typeRef.kind === "string") {
    return { kind: typeRef.kind, name: typeRef.name };
  }

  return getNamedType(typeRef.ofType);
}

function getIntrospectedFields(
  body: unknown,
  typeAlias: string,
): ReadonlyArray<IntrospectedField> | null {
  const type = getData(body, typeAlias);

  if (!isRecord(type) || !Array.isArray(type.fields)) {
    return null;
  }

  return type.fields
    .filter(isRecord)
    .filter((field) => typeof field.name === "string")
    .map((field) => ({
      hasArguments: Array.isArray(field.args) && field.args.length > 0,
      name: String(field.name),
      namedType: getNamedType(field.type),
      type: formatTypeRef(field.type),
    }))
    .toSorted((left, right) => left.name.localeCompare(right.name));
}

function describeFields(fields: ReadonlyArray<IntrospectedField> | null) {
  if (fields === null) {
    return null;
  }

  return Object.fromEntries(
    fields.map((field) => [
      field.name,
      field.hasArguments ? `${field.type} (has arguments)` : field.type,
    ]),
  );
}

function selectLeafFields(fields: ReadonlyArray<IntrospectedField>) {
  return fields
    .filter((field) => {
      return (
        !field.hasArguments &&
        field.namedType !== null &&
        LEAF_TYPE_KINDS.has(field.namedType.kind)
      );
    })
    .map((field) => field.name);
}

function getGraphQLErrors(body: unknown) {
  if (!isRecord(body) || !Array.isArray(body.errors)) {
    return [];
  }

  return body.errors
    .filter(isRecord)
    .map((error) => error.message)
    .filter((message) => typeof message === "string");
}

const executeRequest = E.fnUntraced(function* (
  request: HttpClientRequest.HttpClientRequest,
) {
  const httpClient = yield* HttpClient.HttpClient;
  const response = yield* httpClient.execute(request);
  const text = yield* response.text;

  return {
    body: parseJson(text),
    contentType: response.headers["content-type"] ?? null,
    status: response.status,
  } satisfies HttpResult;
});

const postForm = (parameters: Readonly<Record<string, string>>) =>
  HttpClientRequest.post(FELLOWSHIP_LOGS_TOKEN_URL).pipe(
    HttpClientRequest.acceptJson,
    HttpClientRequest.bodyUrlParams(parameters),
    executeRequest,
  );

const postGraphQL = (accessToken: Redacted.Redacted<string>, query: string) =>
  HttpClientRequest.post(FELLOWSHIP_LOGS_USER_API_URL).pipe(
    HttpClientRequest.acceptJson,
    HttpClientRequest.bearerToken(accessToken),
    HttpClientRequest.bodyText(stringifyJson({ query }), "application/json"),
    executeRequest,
  );

const waitForCallback = (redirectUri: URL) =>
  E.callback<URLSearchParams, FellowshipLogsOAuthProbeError>((resume) => {
    const server = createServer((request, response) => {
      const url = new URL(request.url ?? "/", redirectUri);

      if (url.pathname !== redirectUri.pathname) {
        response.writeHead(404, { Connection: "close" }).end();
        return;
      }

      response
        .writeHead(200, {
          "Cache-Control": "no-store",
          Connection: "close",
          "Content-Type": "text/plain; charset=utf-8",
          "Referrer-Policy": "no-referrer",
        })
        .end(
          "Fellowship Run Tracker received the authorization response. You can close this window.",
          closeServer,
        );
      resume(E.succeed(url.searchParams));
    });

    function closeServer() {
      server.close();
      server.closeAllConnections();
    }

    server.on("error", (cause) => {
      closeServer();
      resume(
        E.fail(
          new FellowshipLogsOAuthProbeError({
            cause,
            message: "The loopback callback listener failed.",
          }),
        ),
      );
    });
    server.listen(Number(redirectUri.port), redirectUri.hostname);

    return E.sync(closeServer);
  });

const checkAccessToken = E.fnUntraced(function* (
  accessToken: Redacted.Redacted<string> | null,
) {
  if (accessToken === null) {
    return null;
  }

  const result = yield* postGraphQL(accessToken, ACCESS_TOKEN_CHECK_QUERY);

  return { errors: getGraphQLErrors(result.body), status: result.status };
});

const probeRateLimitData = E.fnUntraced(function* (
  accessToken: Redacted.Redacted<string>,
  rateLimitFields: ReadonlyArray<IntrospectedField> | null,
) {
  if (rateLimitFields === null) {
    return null;
  }

  const objectFields = rateLimitFields.filter((field) => {
    return !field.hasArguments && field.namedType?.kind === "OBJECT";
  });
  const objectTypes = yield* E.forEach(objectFields, (field) => {
    const typeName = field.namedType?.name ?? "";

    return postGraphQL(
      accessToken,
      `query ProbeType { type: __type(name: "${typeName}") { ${FIELD_SELECTION} } }`,
    ).pipe(
      E.map((result) => ({
        errors: getGraphQLErrors(result.body),
        fieldName: field.name,
        fields: getIntrospectedFields(result.body, "type"),
        typeName,
      })),
    );
  });
  const objectSelections = objectTypes
    .map((objectType) => {
      const leafFields = selectLeafFields(objectType.fields ?? []);

      return leafFields.length === 0
        ? null
        : `${objectType.fieldName} { ${leafFields.join(" ")} }`;
    })
    .filter((selection) => selection !== null);
  const selections = [
    ...selectLeafFields(rateLimitFields),
    ...objectSelections,
  ];
  const values = yield* postGraphQL(
    accessToken,
    `query ProbeRateLimitData { rateLimitData { ${selections.join(" ")} } }`,
  );

  return {
    objectTypes: Object.fromEntries(
      objectTypes.map((objectType) => [
        objectType.fieldName,
        {
          errors: objectType.errors,
          fields: describeFields(objectType.fields),
          typeName: objectType.typeName,
        },
      ]),
    ),
    valueErrors: getGraphQLErrors(values.body),
    values: getData(values.body, "rateLimitData"),
  };
});

const probeUserApi = E.fnUntraced(function* (
  accessToken: Redacted.Redacted<string>,
) {
  const introspection = yield* postGraphQL(accessToken, INTROSPECTION_QUERY);
  const identity = yield* postGraphQL(accessToken, IDENTITY_QUERY);
  const rateLimitFields = getIntrospectedFields(
    introspection.body,
    "rateLimitData",
  );

  return {
    identity: {
      errors: getGraphQLErrors(identity.body),
      status: identity.status,
      valueTypes: describeValueTypes(getData(identity.body, "userData")),
    },
    rateLimitData: yield* probeRateLimitData(accessToken, rateLimitFields),
    schema: {
      errors: getGraphQLErrors(introspection.body),
      rateLimitData: describeFields(rateLimitFields),
      status: introspection.status,
      user: describeFields(getIntrospectedFields(introspection.body, "user")),
      userData: describeFields(
        getIntrospectedFields(introspection.body, "userData"),
      ),
    },
  };
});

const probeTokenLifecycle = E.fnUntraced(function* ({
  clientId,
  exchangeParameters,
  originalAccessToken,
  originalRefreshToken,
}: {
  readonly clientId: string;
  readonly exchangeParameters: Readonly<Record<string, string>>;
  readonly originalAccessToken: Redacted.Redacted<string> | null;
  readonly originalRefreshToken: Redacted.Redacted<string> | null;
}) {
  const refreshWith = (refreshToken: Redacted.Redacted<string>) =>
    postForm({
      client_id: clientId,
      grant_type: "refresh_token",
      refresh_token: Redacted.value(refreshToken),
    });

  const replay = yield* postForm(exchangeParameters);
  const originalAccessTokenAfterReplay =
    yield* checkAccessToken(originalAccessToken);

  if (originalRefreshToken === null) {
    return {
      "1 replayCode": describeTokenResponse(replay),
      "2 originalAccessTokenAfterReplay": originalAccessTokenAfterReplay,
    };
  }

  const firstRefresh = yield* refreshWith(originalRefreshToken);
  const rotatedAccessToken = getStringField(firstRefresh.body, "access_token");
  const rotatedRefreshToken = getStringField(
    firstRefresh.body,
    "refresh_token",
  );
  const originalAccessTokenAfterRefresh =
    yield* checkAccessToken(originalAccessToken);
  const rotatedAccessTokenAfterRefresh =
    yield* checkAccessToken(rotatedAccessToken);

  const reuseOriginalRefreshToken = yield* refreshWith(originalRefreshToken);
  const rotatedAccessTokenAfterReuse =
    yield* checkAccessToken(rotatedAccessToken);
  const refreshWithRotatedTokenAfterReuse =
    rotatedRefreshToken === null
      ? null
      : yield* refreshWith(rotatedRefreshToken);
  const latestAccessToken =
    refreshWithRotatedTokenAfterReuse === null
      ? null
      : getStringField(refreshWithRotatedTokenAfterReuse.body, "access_token");

  return {
    "1 replayCode": describeTokenResponse(replay),
    "2 originalAccessTokenAfterReplay": originalAccessTokenAfterReplay,
    "3 refreshWithOriginalToken": {
      ...describeTokenResponse(firstRefresh),
      refreshTokenRotated:
        rotatedRefreshToken === null
          ? null
          : Redacted.value(rotatedRefreshToken) !==
            Redacted.value(originalRefreshToken),
    },
    "4 originalAccessTokenAfterRefresh": originalAccessTokenAfterRefresh,
    "5 rotatedAccessTokenAfterRefresh": rotatedAccessTokenAfterRefresh,
    "6 reuseOriginalRefreshToken": describeTokenResponse(
      reuseOriginalRefreshToken,
    ),
    "7 rotatedAccessTokenAfterReuse": rotatedAccessTokenAfterReuse,
    "8 refreshWithRotatedTokenAfterReuse":
      refreshWithRotatedTokenAfterReuse === null
        ? null
        : describeTokenResponse(refreshWithRotatedTokenAfterReuse),
    "9 latestAccessToken": yield* checkAccessToken(latestAccessToken),
  };
});

const probeFellowshipLogsOAuth = E.fn("probeFellowshipLogsOAuth")(function* ({
  redirectUri: redirectUriOverride,
}: {
  readonly redirectUri: Option.Option<FellowshipLogsRedirectUri>;
}) {
  const fileSystem = yield* FileSystem.FileSystem;
  const path = yield* Path.Path;
  const clientId = yield* appConfig.fellowshipLogsOAuthClientId.pipe(
    E.flatMap(E.fromOption),
    E.mapError(
      (cause) =>
        new FellowshipLogsOAuthProbeError({
          cause,
          message: "Set FELLOWSHIP_LOGS_OAUTH_CLIENT_ID in .env.",
        }),
    ),
  );
  const redirectUri = Option.getOrElse(redirectUriOverride, () =>
    FellowshipLogsRedirectUriSchema.make(DEFAULT_REDIRECT_URI),
  );
  const redirectUrl = new URL(redirectUri);

  if (redirectUrl.protocol !== "http:" || redirectUrl.port === "") {
    return yield* new FellowshipLogsOAuthProbeError({
      message:
        "The probe only listens on an http://127.0.0.1 redirect URI with an explicit port.",
    });
  }

  const codeVerifier = yield* generateCodeVerifier;
  const state = yield* generateOAuthState;
  const codeChallenge = yield* deriveCodeChallenge(codeVerifier);
  const authorizationUrl = buildAuthorizationUrl({
    clientId,
    codeChallenge,
    redirectUri,
    state,
  });

  const callback = yield* E.gen(function* () {
    yield* Console.log(
      `\nOpen this URL in your browser, sign in, and approve or deny the request. Waiting ${CALLBACK_TIMEOUT} on ${redirectUri}.\n\n${Redacted.value(authorizationUrl)}\n`,
    );

    return yield* waitForCallback(redirectUrl);
  }).pipe(E.scoped, E.timeout(CALLBACK_TIMEOUT));

  const code = callback.get("code");
  const callbackSummary = {
    hasCode: code !== null,
    parameterNames: Array.from(callback.keys()).toSorted(),
    providerError: callback.get("error"),
    providerErrorDescription: callback.get("error_description"),
    stateMatches: callback.get("state") === state,
  };

  const exchangeParameters = {
    client_id: clientId,
    code: code ?? "",
    code_verifier: Redacted.value(codeVerifier),
    grant_type: "authorization_code",
    redirect_uri: redirectUri,
  };
  const exchange =
    code === null || !callbackSummary.stateMatches
      ? null
      : yield* postForm(exchangeParameters);
  const accessToken =
    exchange === null ? null : getStringField(exchange.body, "access_token");
  const refreshToken =
    exchange === null ? null : getStringField(exchange.body, "refresh_token");
  const userApi =
    accessToken === null ? null : yield* probeUserApi(accessToken);
  const tokenLifecycle =
    exchange === null
      ? null
      : yield* probeTokenLifecycle({
          clientId,
          exchangeParameters,
          originalAccessToken: accessToken,
          originalRefreshToken: refreshToken,
        });

  const report = {
    callback: callbackSummary,
    clientId,
    exchange: exchange === null ? null : describeTokenResponse(exchange),
    probedAt: DateTime.formatIso(yield* DateTime.now),
    redirectUri,
    tokenLifecycle,
    userApi,
  };
  const reportJson = `${stringifyJson(report, 2)}\n`;
  const reportPath = path.resolve(
    REPORT_DIRECTORY,
    `report-${report.probedAt.replaceAll(":", "-")}.json`,
  );

  yield* fileSystem.makeDirectory(path.dirname(reportPath), {
    recursive: true,
  });
  yield* fileSystem.writeFileString(reportPath, reportJson);
  yield* Console.log(
    `${reportJson}\nSaved the redacted report to ${reportPath}`,
  );
});

export const probeFellowshipLogsOAuthCommand = Command.make(
  "probe-fellowship-logs-oauth",
  {
    redirectUri: Flag.String("redirect-uri").pipe(
      Flag.withSchema(FellowshipLogsConfiguredRedirectUriSchema),
      Flag.optional,
      Flag.withDescription(
        "Loopback redirect URI with an explicit port. Defaults to http://127.0.0.1:47892/oauth/callback.",
      ),
    ),
  },
  probeFellowshipLogsOAuth,
).pipe(
  Command.withDescription(
    "Run one Fellowship Logs PKCE authorization through a loopback redirect and save a redacted report.",
  ),
  Command.provide(NodeHttpClientLayer),
);
