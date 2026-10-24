import * as Match from "effect/Match";
import { TriangleAlertIcon, XCircleIcon } from "lucide-react";

import { type FellowshipLogsApiAuthorizationStatus } from "@frt/shared/fellowship-logs/fellowship-logs-connection-api-schema.ts";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@frt/ui/primitives/alert.tsx";

import { OwnClientRequirements } from "./own-client-requirements.tsx";

const FAILURE_MESSAGES = {
  CONNECTION_CHANGED:
    "Your Fellowship Logs connection changed while you were signing in, so nothing was replaced. Review it, then sign in again.",
  LOCAL_PROTECTION_ACKNOWLEDGEMENT_REQUIRED:
    "Secure system storage wasn't available to save your sign-in. Sign in again and choose local encryption.",
  OWN_CLIENT_REJECTED:
    "Fellowship Logs rejected your client. Check its settings below.",
  PROVIDER_REJECTED: "Fellowship Logs rejected the sign-in. Try again.",
  PROVIDER_UNAVAILABLE: "Fellowship Logs couldn't be reached. Try again.",
  PROVIDER_UNEXPECTED_RESPONSE:
    "Fellowship Logs sent a response the app didn't understand. Try again.",
  STORAGE: "Your sign-in couldn't be saved. Try again.",
} as const;

type AuthorizationOutcomeProps = {
  readonly authorization: FellowshipLogsApiAuthorizationStatus;
};

export function AuthorizationOutcome({
  authorization,
}: AuthorizationOutcomeProps) {
  return Match.value(authorization).pipe(
    Match.when({ state: "DENIED" }, () => (
      <Alert role="status" variant="warning">
        <TriangleAlertIcon />
        <AlertTitle>Sign-in declined</AlertTitle>
        <AlertDescription>
          You declined access in Fellowship Logs. Nothing was saved.
        </AlertDescription>
      </Alert>
    )),
    Match.when({ state: "EXPIRED" }, (expired) => (
      <Alert role="status" variant="warning">
        <TriangleAlertIcon />
        <AlertTitle>Sign-in expired</AlertTitle>
        <AlertDescription>
          The sign-in wasn't finished in time. Start again.
          {expired.profile === "OWN_CLIENT_USER" ? (
            <OwnClientRequirements mode="sign-in" />
          ) : null}
        </AlertDescription>
      </Alert>
    )),
    Match.when({ state: "FAILED" }, (failed) => (
      <Alert role="alert" variant="destructive">
        <XCircleIcon />
        <AlertTitle>Sign-in failed</AlertTitle>
        <AlertDescription>
          {FAILURE_MESSAGES[failed.failure]}
          {failed.failure === "OWN_CLIENT_REJECTED" ? (
            <OwnClientRequirements mode="sign-in" />
          ) : null}
        </AlertDescription>
      </Alert>
    )),
    Match.whenOr(
      { state: "CANCELLED" },
      { state: "CONNECTED" },
      { state: "IDLE" },
      { state: "PENDING" },
      () => null,
    ),
    Match.exhaustive,
  );
}
