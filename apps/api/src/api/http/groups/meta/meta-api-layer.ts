import * as E from "effect/Effect";
import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import type * as Layer from "effect/Layer";

import { AppVersion } from "@frt/api/services/app-version/app-version-service.ts";
import { API_CONTRACT_VERSION } from "@frt/api-contract/constants/api-contract-version.ts";
import { AppHttpApi } from "@frt/api-contract/http/http-api.ts";

const MetaApiHandlersInferred = HttpApiBuilder.group(
  AppHttpApi,
  "meta",
  E.fn(function* (handlers) {
    const appVersion = yield* AppVersion;

    return handlers.handle("getMeta", () => {
      return E.succeed({
        apiContractVersion: API_CONTRACT_VERSION,
        appVersion,
      });
    });
  }),
);

export const MetaApiLayer: Layer.Layer<
  Layer.Success<typeof MetaApiHandlersInferred>,
  Layer.Error<typeof MetaApiHandlersInferred>,
  AppVersion
> = MetaApiHandlersInferred;
