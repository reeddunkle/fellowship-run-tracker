import { useQuery } from "@tanstack/react-query";
import { PlayIcon, TriangleAlertIcon } from "lucide-react";
import { useRef, useState } from "react";

import { type BackgroundJobId } from "@frt/shared/background-job/background-job-id-schema.ts";
import { type FellowshipLogsApiConnection } from "@frt/shared/fellowship-logs/fellowship-logs-connection-api-schema.ts";
import { getErrorTag } from "@frt/shared/util/get-error-tag.ts";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@frt/ui/primitives/alert.tsx";
import { Button } from "@frt/ui/primitives/button.tsx";

import { useResumeImportJobWithCurrentConnection } from "@/renderer/api/fellowship-logs/fellowship-logs-mutations.ts";
import { getFellowshipLogsConnectionStatusQueryOptions } from "@/renderer/api/fellowship-logs-connection/fellowship-logs-connection-queries.ts";

import { FELLOWSHIP_LOGS_PROFILE_COPY } from "./connection/fellowship-logs-connection-copy.ts";
import { getConnectionErrorMessage } from "./connection/get-connection-error-message.ts";

function getResumeErrorMessage(error: unknown): string {
  return getErrorTag(error) === "NotFound"
    ? "This import is no longer waiting for confirmation."
    : getConnectionErrorMessage(error);
}

function getConnectionName(connection: FellowshipLogsApiConnection): string {
  const { title } = FELLOWSHIP_LOGS_PROFILE_COPY[connection.profile];

  return connection.connectedUserName === null
    ? title
    : `${title} as ${connection.connectedUserName}`;
}

type ResumeImportWithCurrentConnectionProps = {
  readonly jobId: BackgroundJobId;
};

export function ResumeImportWithCurrentConnection({
  jobId,
}: ResumeImportWithCurrentConnectionProps) {
  const [isConfirming, setIsConfirming] = useState(false);
  const shouldRestoreFocusRef = useRef(false);
  const { data: status } = useQuery(
    getFellowshipLogsConnectionStatusQueryOptions(),
  );
  const resumeMutation = useResumeImportJobWithCurrentConnection();

  const connection = status?.connection ?? null;

  if (connection === null) {
    return status === undefined ? null : (
      <p className="text-xs text-muted-foreground">
        Connect to Fellowship Logs above to continue it.
      </p>
    );
  }

  if (!isConfirming) {
    return (
      <div>
        <Button
          onClick={() => {
            resumeMutation.reset();
            setIsConfirming(true);
          }}
          ref={(trigger) => {
            if (trigger !== null && shouldRestoreFocusRef.current) {
              shouldRestoreFocusRef.current = false;
              trigger.focus();
            }
          }}
          size="sm"
          type="button"
          variant="outline"
        >
          <PlayIcon />
          Continue with current connection
        </Button>
      </div>
    );
  }

  const titleId = `resume-import-${jobId}-title`;
  const descriptionId = `resume-import-${jobId}-description`;
  const { spending } = FELLOWSHIP_LOGS_PROFILE_COPY[connection.profile];

  return (
    <Alert
      aria-describedby={descriptionId}
      aria-labelledby={titleId}
      role="alertdialog"
      variant="warning"
    >
      <TriangleAlertIcon />
      <AlertTitle id={titleId}>
        Continue with {getConnectionName(connection)}?
      </AlertTitle>
      <AlertDescription id={descriptionId}>
        <p>
          This import was queued under a different connection. From now on it{" "}
          {spending.charAt(0).toLowerCase() + spending.slice(1)}. Points used
          after this change won't count toward your import cost estimate.
        </p>
        {resumeMutation.isError ? (
          <p role="alert">{getResumeErrorMessage(resumeMutation.error)}</p>
        ) : null}
        <div className="mt-2 flex flex-wrap gap-2">
          <Button
            disabled={resumeMutation.isPending}
            onClick={() => {
              resumeMutation.resume(
                { jobId },
                {
                  onSuccess: () => {
                    setIsConfirming(false);
                  },
                },
              );
            }}
            size="sm"
            type="button"
          >
            Continue import
          </Button>
          <Button
            autoFocus
            onClick={() => {
              shouldRestoreFocusRef.current = true;
              setIsConfirming(false);
            }}
            size="sm"
            type="button"
            variant="ghost"
          >
            Not now
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
