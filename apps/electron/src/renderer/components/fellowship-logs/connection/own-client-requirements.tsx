import { CheckIcon, CopyIcon, ExternalLinkIcon } from "lucide-react";
import { useState } from "react";

import { FELLOWSHIP_LOGS_OWN_CLIENT_REDIRECT_URI } from "@frt/shared/fellowship-logs/fellowship-logs-own-client-requirements.ts";
import { Button } from "@frt/ui/primitives/button.tsx";

import { FELLOWSHIP_LOGS_CLIENTS_URL } from "./fellowship-logs-connection-copy.ts";

type OwnClientRequirementsProps = {
  readonly mode: "credentials" | "sign-in";
};

export function OwnClientRequirements({ mode }: OwnClientRequirementsProps) {
  const [isCopied, setIsCopied] = useState(false);

  return (
    <div className="flex flex-col gap-2 text-sm">
      <p className="font-medium">Set up your API client</p>
      <ol className="flex list-decimal flex-col gap-2 pl-5 text-muted-foreground">
        <li>
          <a
            className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline"
            href={FELLOWSHIP_LOGS_CLIENTS_URL}
            rel="noreferrer"
            target="_blank"
          >
            Create or manage your Fellowship Logs API clients
            <ExternalLinkIcon className="size-3.5" />
          </a>
          .
        </li>
        <li>
          Enter this callback URL when Fellowship Logs asks for one:
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <code className="select-text rounded bg-muted px-1.5 py-1 text-xs text-foreground">
              {FELLOWSHIP_LOGS_OWN_CLIENT_REDIRECT_URI}
            </code>
            <Button
              onClick={() => {
                void navigator.clipboard
                  .writeText(FELLOWSHIP_LOGS_OWN_CLIENT_REDIRECT_URI)
                  .then(() => {
                    setIsCopied(true);
                  });
              }}
              size="xs"
              type="button"
              variant="outline"
            >
              {isCopied ? <CheckIcon /> : <CopyIcon />}
              {isCopied ? "Copied" : "Copy"}
            </Button>
          </div>
        </li>
        {mode === "sign-in" ? (
          <li>
            Enable Public Client. This lets Fellowship Logs handle your browser
            sign-in without giving Fellowship Run Tracker your password.
          </li>
        ) : null}
        <li>
          Return here and enter{" "}
          {mode === "sign-in"
            ? "your public client ID."
            : "your client ID and secret."}
        </li>
      </ol>
    </div>
  );
}
