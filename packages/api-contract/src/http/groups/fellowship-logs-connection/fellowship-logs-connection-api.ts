import * as HttpApiEndpoint from "effect/http-api/HttpApiEndpoint";
import * as HttpApiError from "effect/http-api/HttpApiError";
import * as HttpApiGroup from "effect/http-api/HttpApiGroup";
import * as Schema from "effect/Schema";

import {
  FellowshipLogsApiAuthorizationCallbackInvalidError,
  FellowshipLogsApiAuthorizationFailedError,
  FellowshipLogsApiAuthorizationNotConfiguredError,
  FellowshipLogsApiAuthorizationNotPendingError,
  FellowshipLogsApiConnectionChangedError,
  FellowshipLogsApiConnectionReplacementConfirmationRequiredError,
  FellowshipLogsApiInvalidCredentialsError,
  FellowshipLogsApiLocalProtectionAcknowledgementRequiredError,
} from "@frt/api-contract/errors/fellowship-logs-api-error.ts";
import { FellowshipLogsGatewayApiErrors } from "@frt/api-contract/http/groups/fellowship-logs/fellowship-logs-gateway-api-errors.ts";
import {
  FellowshipLogsApiCompleteAuthorizationOptionsSchema,
  FellowshipLogsApiCompletedAuthorizationSchema,
  FellowshipLogsApiConnectionSchema,
  FellowshipLogsApiConnectionStatusSchema,
  FellowshipLogsApiPointSystemOptInCheckSchema,
  FellowshipLogsApiSaveOwnClientOptionsSchema,
  FellowshipLogsApiStartAuthorizationOptionsSchema,
  FellowshipLogsApiStartedAuthorizationSchema,
} from "@frt/shared/fellowship-logs/fellowship-logs-connection-api-schema.ts";

const CONNECTION_ROUTE = "/fellowship-logs/connection" as const;

const AUTHORIZATION_ROUTE = `${CONNECTION_ROUTE}/authorization` as const;

const GetFellowshipLogsConnectionEndpoint = HttpApiEndpoint.get(
  "getFellowshipLogsConnection",
  CONNECTION_ROUTE,
  {
    error: HttpApiError.InternalServerErrorNoContent,
    success: FellowshipLogsApiConnectionStatusSchema,
  },
);

const StartFellowshipLogsAuthorizationEndpoint = HttpApiEndpoint.post(
  "startFellowshipLogsAuthorization",
  AUTHORIZATION_ROUTE,
  {
    error: [
      FellowshipLogsApiAuthorizationNotConfiguredError,
      FellowshipLogsApiConnectionChangedError,
      FellowshipLogsApiConnectionReplacementConfirmationRequiredError,
      FellowshipLogsApiLocalProtectionAcknowledgementRequiredError,
      HttpApiError.InternalServerErrorNoContent,
    ],
    payload: FellowshipLogsApiStartAuthorizationOptionsSchema,
    success: FellowshipLogsApiStartedAuthorizationSchema,
  },
);

const CompleteFellowshipLogsAuthorizationEndpoint = HttpApiEndpoint.post(
  "completeFellowshipLogsAuthorization",
  `${AUTHORIZATION_ROUTE}/callback`,
  {
    error: [
      FellowshipLogsApiAuthorizationCallbackInvalidError,
      FellowshipLogsApiAuthorizationFailedError,
      FellowshipLogsApiAuthorizationNotPendingError,
      FellowshipLogsApiConnectionChangedError,
      FellowshipLogsApiLocalProtectionAcknowledgementRequiredError,
      HttpApiError.InternalServerErrorNoContent,
    ],
    payload: FellowshipLogsApiCompleteAuthorizationOptionsSchema,
    success: FellowshipLogsApiCompletedAuthorizationSchema,
  },
);

const CancelFellowshipLogsAuthorizationEndpoint = HttpApiEndpoint.delete(
  "cancelFellowshipLogsAuthorization",
  AUTHORIZATION_ROUTE,
  {
    error: HttpApiError.InternalServerErrorNoContent,
    success: Schema.Void,
  },
);

const SaveFellowshipLogsOwnClientEndpoint = HttpApiEndpoint.put(
  "saveFellowshipLogsOwnClient",
  `${CONNECTION_ROUTE}/own-client`,
  {
    error: [
      FellowshipLogsApiAuthorizationFailedError,
      FellowshipLogsApiConnectionChangedError,
      FellowshipLogsApiConnectionReplacementConfirmationRequiredError,
      FellowshipLogsApiInvalidCredentialsError,
      FellowshipLogsApiLocalProtectionAcknowledgementRequiredError,
      HttpApiError.InternalServerErrorNoContent,
    ],
    payload: FellowshipLogsApiSaveOwnClientOptionsSchema,
    success: FellowshipLogsApiConnectionSchema,
  },
);

const DisconnectFellowshipLogsEndpoint = HttpApiEndpoint.delete(
  "disconnectFellowshipLogs",
  CONNECTION_ROUTE,
  {
    error: HttpApiError.InternalServerErrorNoContent,
    success: Schema.Void,
  },
);

const CheckFellowshipLogsPointSystemOptInEndpoint = HttpApiEndpoint.post(
  "checkFellowshipLogsPointSystemOptIn",
  `${CONNECTION_ROUTE}/point-system-opt-in-check`,
  {
    error: FellowshipLogsGatewayApiErrors,
    success: FellowshipLogsApiPointSystemOptInCheckSchema,
  },
);

export const FellowshipLogsConnectionApi = HttpApiGroup.make(
  "fellowshipLogsConnection",
)
  .add(GetFellowshipLogsConnectionEndpoint)
  .add(StartFellowshipLogsAuthorizationEndpoint)
  .add(CompleteFellowshipLogsAuthorizationEndpoint)
  .add(CancelFellowshipLogsAuthorizationEndpoint)
  .add(SaveFellowshipLogsOwnClientEndpoint)
  .add(DisconnectFellowshipLogsEndpoint)
  .add(CheckFellowshipLogsPointSystemOptInEndpoint);
