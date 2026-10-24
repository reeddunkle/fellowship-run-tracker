import { TriangleAlertIcon, XCircleIcon } from "lucide-react";

import { StatusText } from "@frt/ui/composites/status-text.tsx";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@frt/ui/primitives/alert.tsx";
import { Button } from "@frt/ui/primitives/button.tsx";

import { FELLOWSHIP_LOGS_PROFILE_COPY } from "./fellowship-logs-connection-copy.ts";
import {
  getConnectionErrorMessage,
  isLocalProtectionAcknowledgementRequired,
  isReplacementConfirmationRequired,
} from "./get-connection-error-message.ts";

export type ConnectionCommandFlags = {
  readonly allowLocalFallback?: boolean;
  readonly replaceConnection?: boolean;
};

type ConnectionCommandFeedbackProps = {
  readonly error: unknown;
  readonly isPending: boolean;
  readonly onRetry: (flags: ConnectionCommandFlags) => void;
};

export function ConnectionCommandFeedback({
  error,
  isPending,
  onRetry,
}: ConnectionCommandFeedbackProps) {
  if (error === null || error === undefined) {
    return null;
  }

  if (isLocalProtectionAcknowledgementRequired(error)) {
    return (
      <Alert role="alert" variant="warning">
        <TriangleAlertIcon />
        <AlertTitle>Secure system storage isn't available</AlertTitle>
        <AlertDescription>
          Fellowship Run Tracker can store your credentials with a local
          encryption key instead. Anyone who can use your account on this device
          could read them.
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              disabled={isPending}
              onClick={() => {
                onRetry({ allowLocalFallback: true });
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              Use local encryption
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  if (isReplacementConfirmationRequired(error)) {
    return (
      <Alert role="alert" variant="warning">
        <TriangleAlertIcon />
        <AlertTitle>Replace your current connection?</AlertTitle>
        <AlertDescription>
          This replaces your{" "}
          {FELLOWSHIP_LOGS_PROFILE_COPY[error.currentProfile].title} connection.
          Imported runs, the import queue, and cached reports stay.
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              disabled={isPending}
              onClick={() => {
                onRetry({ replaceConnection: true });
              }}
              size="sm"
              type="button"
              variant="outline"
            >
              Replace connection
            </Button>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <StatusText role="alert" variant="destructive">
      <XCircleIcon />
      {getConnectionErrorMessage(error)}
    </StatusText>
  );
}
