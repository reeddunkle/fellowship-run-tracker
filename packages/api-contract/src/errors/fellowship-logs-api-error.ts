import * as Schema from "effect/Schema";

import { DungeonRunIdSchema } from "@frt/shared/dungeon-run/dungeon-run-id-schema.ts";
import { FellowshipLogsConnectionProfileSchema } from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";
import { FellowshipLogsFightIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-fight-id-schema.ts";
import { FellowshipLogsReportCodeSchema } from "@frt/shared/fellowship-logs/fellowship-logs-report-code-schema.ts";
import { NonNegativeIntegerSchema } from "@frt/shared/util/common-schemas.ts";

const FellowshipLogsApiRunFields = {
  fightId: FellowshipLogsFightIdSchema,
  reportCode: FellowshipLogsReportCodeSchema,
};

export class FellowshipLogsApiRunNotFoundError extends Schema.TaggedError<FellowshipLogsApiRunNotFoundError>()(
  "FellowshipLogsApiRunNotFoundError",
  FellowshipLogsApiRunFields,
  { httpApiStatus: 404 },
) {
  override get message() {
    return "We couldn't find that report and fight.";
  }
}

export class FellowshipLogsApiReportAccessDeniedError extends Schema.TaggedError<FellowshipLogsApiReportAccessDeniedError>()(
  "FellowshipLogsApiReportAccessDeniedError",
  FellowshipLogsApiRunFields,
  { httpApiStatus: 403 },
) {
  override get message() {
    return "This connection doesn't have permission to view that report.";
  }
}

export class FellowshipLogsApiRunNotFinishedError extends Schema.TaggedError<FellowshipLogsApiRunNotFinishedError>()(
  "FellowshipLogsApiRunNotFinishedError",
  FellowshipLogsApiRunFields,
  { httpApiStatus: 409 },
) {
  override get message() {
    return "This run hasn't finished yet.";
  }
}

export class FellowshipLogsApiDungeonLevelNotFoundError extends Schema.TaggedError<FellowshipLogsApiDungeonLevelNotFoundError>()(
  "FellowshipLogsApiDungeonLevelNotFoundError",
  FellowshipLogsApiRunFields,
  { httpApiStatus: 422 },
) {
  override get message() {
    return "This run doesn't have a dungeon level, so it can't be imported.";
  }
}

export class FellowshipLogsApiAlreadyImportedError extends Schema.TaggedError<FellowshipLogsApiAlreadyImportedError>()(
  "FellowshipLogsApiAlreadyImportedError",
  {
    ...FellowshipLogsApiRunFields,
    dungeonRunId: DungeonRunIdSchema,
  },
  { httpApiStatus: 409 },
) {
  override get message() {
    return "This run has already been imported.";
  }
}

const RATE_LIMIT_EXCEEDED_MESSAGES = {
  APPLICATION_POINTS_EXHAUSTED:
    "You've used all your API client points for this hour.",
  SHARED_APPLICATION_CAPACITY_UNAVAILABLE:
    "Fellowship Logs is temporarily limiting this connection.",
  USER_POINTS_EXHAUSTED: "You've used all your account points for now.",
} as const;

export class FellowshipLogsApiRateLimitExceededError extends Schema.TaggedError<FellowshipLogsApiRateLimitExceededError>()(
  "FellowshipLogsApiRateLimitExceededError",
  {
    reason: Schema.Literals([
      "APPLICATION_POINTS_EXHAUSTED",
      "SHARED_APPLICATION_CAPACITY_UNAVAILABLE",
      "USER_POINTS_EXHAUSTED",
    ]),
    resetsAtMilliseconds: NonNegativeIntegerSchema,
  },
  { httpApiStatus: 429 },
) {
  override get message() {
    return RATE_LIMIT_EXCEEDED_MESSAGES[this.reason];
  }
}

const CONNECTION_REQUIRED_MESSAGES = {
  NOT_CONNECTED: "Connect to Fellowship Logs first.",
  REAUTHORIZATION_REQUIRED: "Sign in to Fellowship Logs again.",
} as const;

export class FellowshipLogsApiConnectionRequiredError extends Schema.TaggedError<FellowshipLogsApiConnectionRequiredError>()(
  "FellowshipLogsApiConnectionRequiredError",
  {
    reason: Schema.Literals(["NOT_CONNECTED", "REAUTHORIZATION_REQUIRED"]),
  },
  { httpApiStatus: 409 },
) {
  override get message() {
    return CONNECTION_REQUIRED_MESSAGES[this.reason];
  }
}

export class FellowshipLogsApiLocalProtectionAcknowledgementRequiredError extends Schema.TaggedError<FellowshipLogsApiLocalProtectionAcknowledgementRequiredError>()(
  "FellowshipLogsApiLocalProtectionAcknowledgementRequiredError",
  {},
  { httpApiStatus: 409 },
) {
  override get message() {
    return "Secure system storage isn't available. Confirm that this device may store your Fellowship Logs sign-in with local encryption.";
  }
}

export class FellowshipLogsApiPointSystemOptInRequiredError extends Schema.TaggedError<FellowshipLogsApiPointSystemOptInRequiredError>()(
  "FellowshipLogsApiPointSystemOptInRequiredError",
  {},
  { httpApiStatus: 409 },
) {
  override get message() {
    return "Opt into the Fellowship Logs point system, then check again.";
  }
}

const OPERATION_UNAVAILABLE_MESSAGES = {
  NON_USER_POINTS_REQUIRED:
    "Fellowship Logs refused this request because it would use points other than your account points.",
  NOT_USER_ELIGIBLE:
    "This request can't be limited to your account points, so it wasn't sent.",
} as const;

export class FellowshipLogsApiOperationUnavailableError extends Schema.TaggedError<FellowshipLogsApiOperationUnavailableError>()(
  "FellowshipLogsApiOperationUnavailableError",
  {
    reason: Schema.Literals(["NON_USER_POINTS_REQUIRED", "NOT_USER_ELIGIBLE"]),
  },
  { httpApiStatus: 422 },
) {
  override get message() {
    return OPERATION_UNAVAILABLE_MESSAGES[this.reason];
  }
}

export class FellowshipLogsApiInvalidCredentialsError extends Schema.TaggedError<FellowshipLogsApiInvalidCredentialsError>()(
  "FellowshipLogsApiInvalidCredentialsError",
  {},
  { httpApiStatus: 422 },
) {
  override get message() {
    return "Fellowship Logs didn't accept that client ID and secret.";
  }
}

const CALLBACK_INVALID_MESSAGES = {
  INVALID_CALLBACK: "That isn't a Fellowship Logs sign-in response.",
  STATE_MISMATCH:
    "That sign-in response belongs to a different sign-in attempt.",
} as const;

export class FellowshipLogsApiAuthorizationCallbackInvalidError extends Schema.TaggedError<FellowshipLogsApiAuthorizationCallbackInvalidError>()(
  "FellowshipLogsApiAuthorizationCallbackInvalidError",
  {
    reason: Schema.Literals(["INVALID_CALLBACK", "STATE_MISMATCH"]),
  },
  { httpApiStatus: 400 },
) {
  override get message() {
    return CALLBACK_INVALID_MESSAGES[this.reason];
  }
}

const AUTHORIZATION_NOT_PENDING_MESSAGES = {
  EXPIRED: "The Fellowship Logs sign-in expired. Start again.",
  NO_PENDING_AUTHORIZATION: "There's no Fellowship Logs sign-in in progress.",
} as const;

export class FellowshipLogsApiAuthorizationNotPendingError extends Schema.TaggedError<FellowshipLogsApiAuthorizationNotPendingError>()(
  "FellowshipLogsApiAuthorizationNotPendingError",
  {
    reason: Schema.Literals(["EXPIRED", "NO_PENDING_AUTHORIZATION"]),
  },
  { httpApiStatus: 409 },
) {
  override get message() {
    return AUTHORIZATION_NOT_PENDING_MESSAGES[this.reason];
  }
}

const AUTHORIZATION_FAILED_MESSAGES = {
  OWN_CLIENT_REJECTED:
    "Fellowship Logs rejected your client. Check that it's a public client with the loopback redirect.",
  PROVIDER_REJECTED: "Fellowship Logs rejected the sign-in.",
  PROVIDER_UNAVAILABLE: "Fellowship Logs couldn't be reached.",
  PROVIDER_UNEXPECTED_RESPONSE:
    "Fellowship Logs sent a response the app didn't understand.",
} as const;

export class FellowshipLogsApiAuthorizationFailedError extends Schema.TaggedError<FellowshipLogsApiAuthorizationFailedError>()(
  "FellowshipLogsApiAuthorizationFailedError",
  {
    failure: Schema.Literals([
      "OWN_CLIENT_REJECTED",
      "PROVIDER_REJECTED",
      "PROVIDER_UNAVAILABLE",
      "PROVIDER_UNEXPECTED_RESPONSE",
    ]),
  },
  { httpApiStatus: 502 },
) {
  override get message() {
    return AUTHORIZATION_FAILED_MESSAGES[this.failure];
  }
}

export class FellowshipLogsApiAuthorizationNotConfiguredError extends Schema.TaggedError<FellowshipLogsApiAuthorizationNotConfiguredError>()(
  "FellowshipLogsApiAuthorizationNotConfiguredError",
  {},
  { httpApiStatus: 503 },
) {
  override get message() {
    return "This build of Fellowship Run Tracker can't sign in to Fellowship Logs.";
  }
}

export class FellowshipLogsApiConnectionChangedError extends Schema.TaggedError<FellowshipLogsApiConnectionChangedError>()(
  "FellowshipLogsApiConnectionChangedError",
  {},
  { httpApiStatus: 409 },
) {
  override get message() {
    return "Your Fellowship Logs connection changed. Review it, then try again.";
  }
}

export class FellowshipLogsApiConnectionReplacementConfirmationRequiredError extends Schema.TaggedError<FellowshipLogsApiConnectionReplacementConfirmationRequiredError>()(
  "FellowshipLogsApiConnectionReplacementConfirmationRequiredError",
  {
    currentProfile: FellowshipLogsConnectionProfileSchema,
  },
  { httpApiStatus: 409 },
) {
  override get message() {
    return "This replaces your current Fellowship Logs connection. Confirm to continue.";
  }
}
