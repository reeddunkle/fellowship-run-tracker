import * as Redacted from "effect/Redacted";
import {
  CheckIcon,
  CopyIcon,
  LoaderCircleIcon,
  XCircleIcon,
} from "lucide-react";
import { useState } from "react";

import {
  type FellowshipLogsApiAuthorizationStatus,
  type FellowshipLogsApiStartedAuthorization,
} from "@frt/shared/fellowship-logs/fellowship-logs-connection-api-schema.ts";
import { StatusText } from "@frt/ui/composites/status-text.tsx";
import { Button } from "@frt/ui/primitives/button.tsx";
import {
  Field,
  FieldDescription,
  FieldLabel,
} from "@frt/ui/primitives/field.tsx";
import { Input } from "@frt/ui/primitives/input.tsx";

import {
  useCancelFellowshipLogsAuthorization,
  useCompleteFellowshipLogsAuthorization,
} from "@/renderer/api/fellowship-logs-connection/fellowship-logs-connection-mutations.ts";
import { useNowMilliseconds } from "@/renderer/stores/clock/use-now-milliseconds.ts";

import { FELLOWSHIP_LOGS_PROFILE_COPY } from "./fellowship-logs-connection-copy.ts";
import { getConnectionErrorMessage } from "./get-connection-error-message.ts";
import { OwnClientRequirements } from "./own-client-requirements.tsx";

type PendingAuthorizationProps = {
  readonly authorization: Extract<
    FellowshipLogsApiAuthorizationStatus,
    { readonly state: "PENDING" }
  >;
  readonly started: FellowshipLogsApiStartedAuthorization | null;
};

function formatMinutesLeft(expiresAtMilliseconds: number, now: number) {
  const minutes = Math.max(
    Math.ceil((expiresAtMilliseconds - now) / 60_000),
    0,
  );

  return minutes === 1 ? "1 minute" : `${minutes} minutes`;
}

type CopyState = "COPIED" | "FAILED" | "IDLE";

function CopyLinkButton({ url }: { readonly url: string }) {
  const [copyState, setCopyState] = useState<CopyState>("IDLE");

  return (
    <>
      <Button
        onClick={() => {
          navigator.clipboard.writeText(url).then(
            () => {
              setCopyState("COPIED");
            },
            () => {
              setCopyState("FAILED");
            },
          );
        }}
        size="sm"
        type="button"
        variant="outline"
      >
        {copyState === "COPIED" ? <CheckIcon /> : <CopyIcon />}
        {copyState === "COPIED" ? "Link copied" : "Copy sign-in link"}
      </Button>
      {copyState === "FAILED" ? (
        <StatusText role="alert" size="xs" variant="destructive">
          <XCircleIcon />
          The link couldn't be copied. Try again.
        </StatusText>
      ) : null}
    </>
  );
}

export function PendingAuthorization({
  authorization,
  started,
}: PendingAuthorizationProps) {
  const nowMilliseconds = useNowMilliseconds();
  const cancelMutation = useCancelFellowshipLogsAuthorization();
  const completeMutation = useCompleteFellowshipLogsAuthorization();
  const [callbackUrl, setCallbackUrl] = useState("");

  const browserFailed = started !== null && started.browserLaunch !== "OPENED";

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-2">
        <LoaderCircleIcon
          aria-hidden="true"
          className="mt-0.5 size-4 animate-spin text-muted-foreground"
        />
        <div className="flex flex-col gap-1">
          <output className="block text-sm font-medium">
            {browserFailed
              ? "Your browser didn't open. Copy the sign-in link into your browser to continue."
              : "Finish signing in to Fellowship Logs in your browser."}
          </output>
          <p className="text-xs text-muted-foreground">
            {FELLOWSHIP_LOGS_PROFILE_COPY[authorization.profile].title}. This
            sign-in expires in{" "}
            {formatMinutesLeft(
              authorization.expiresAtMilliseconds,
              nowMilliseconds,
            )}
            .
          </p>
        </div>
      </div>
      {authorization.profile === "OWN_CLIENT_USER" ? (
        <OwnClientRequirements mode="sign-in" />
      ) : null}
      <div className="flex flex-wrap gap-2">
        {started === null ? null : (
          <CopyLinkButton url={started.authorizationUrl} />
        )}
        <Button
          disabled={cancelMutation.isPending}
          onClick={() => {
            cancelMutation.mutate();
          }}
          size="sm"
          type="button"
          variant="ghost"
        >
          Cancel sign-in
        </Button>
      </div>
      {cancelMutation.isError ? (
        <StatusText role="alert" variant="destructive">
          <XCircleIcon />
          {getConnectionErrorMessage(cancelMutation.error)}
        </StatusText>
      ) : null}
      <form
        aria-label="Finish signing in manually"
        className="flex flex-col gap-2"
        onSubmit={(event) => {
          event.preventDefault();

          if (callbackUrl.trim() === "") {
            return;
          }

          completeMutation.mutate({
            callbackUrl: Redacted.make(callbackUrl.trim()),
          });
        }}
      >
        <Field>
          <FieldLabel htmlFor="fellowship-logs-callback-url">
            Finished in another browser?
          </FieldLabel>
          <FieldDescription>
            Paste the address of the page Fellowship Logs sent you to after you
            approved access.
          </FieldDescription>
          <div className="flex gap-2">
            <Input
              autoComplete="off"
              id="fellowship-logs-callback-url"
              onChange={(event) => {
                setCallbackUrl(event.target.value);
              }}
              placeholder="http://127.0.0.1:…/oauth/callback?…"
              spellCheck={false}
              value={callbackUrl}
            />
            <Button
              disabled={completeMutation.isPending}
              type="submit"
              variant="outline"
            >
              Finish
            </Button>
          </div>
        </Field>
        {completeMutation.isError ? (
          <StatusText role="alert" variant="destructive">
            <XCircleIcon />
            {getConnectionErrorMessage(completeMutation.error)}
          </StatusText>
        ) : null}
      </form>
    </div>
  );
}
