import { useQueryClient } from "@tanstack/react-query";
import {
  CatchBoundary,
  type ErrorComponentProps,
} from "@tanstack/react-router";
import { RefreshCwIcon, XCircleIcon } from "lucide-react";
import { Suspense, useState } from "react";

import {
  Section,
  SectionDescription,
  SectionHeader,
  SectionTitle,
} from "@frt/ui/composites/section.tsx";
import { StatusText } from "@frt/ui/composites/status-text.tsx";
import { Button } from "@frt/ui/primitives/button.tsx";
import { Card, CardContent } from "@frt/ui/primitives/card.tsx";
import { Skeleton } from "@frt/ui/primitives/skeleton.tsx";

import { useLatestStartedFellowshipLogsAuthorization } from "@/renderer/api/fellowship-logs-connection/fellowship-logs-connection-mutations.ts";
import {
  getFellowshipLogsConnectionStatusQueryOptions,
  useFellowshipLogsConnectionStatusSuspense,
} from "@/renderer/api/fellowship-logs-connection/fellowship-logs-connection-queries.ts";
import { logBoundaryError } from "@/renderer/logging/renderer-error-logging.ts";

import { AuthorizationOutcome } from "./authorization-outcome.tsx";
import { ConnectedConnection } from "./connected-connection.tsx";
import { ConnectionChooser } from "./connection-chooser.tsx";
import { PendingAuthorization } from "./pending-authorization.tsx";

export function FellowshipLogsConnectionSection() {
  return (
    <Card>
      <CardContent className="@container">
        <Section>
          <SectionHeader>
            <SectionTitle>Connection</SectionTitle>
            <SectionDescription>
              Choose how Fellowship Run Tracker connects to Fellowship Logs and
              which points are used.
            </SectionDescription>
          </SectionHeader>
          <CatchBoundary
            errorComponent={ConnectionLoadError}
            getResetKey={() => "fellowship-logs-connection"}
            onCatch={logBoundaryError}
          >
            <Suspense fallback={<ConnectionSkeleton />}>
              <ConnectionContent />
            </Suspense>
          </CatchBoundary>
        </Section>
      </CardContent>
    </Card>
  );
}

function ConnectionLoadError({ reset }: ErrorComponentProps) {
  const queryClient = useQueryClient();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <StatusText size="xs" variant="destructive">
        <XCircleIcon />
        Failed to load the Fellowship Logs connection.
      </StatusText>
      <Button
        onClick={() => {
          queryClient.removeQueries({
            queryKey: getFellowshipLogsConnectionStatusQueryOptions().queryKey,
          });
          reset();
        }}
        size="sm"
        type="button"
        variant="outline"
      >
        <RefreshCwIcon />
        Try again
      </Button>
    </div>
  );
}

function ConnectionSkeleton() {
  return (
    <section
      aria-busy="true"
      aria-label="Loading the Fellowship Logs connection"
      className="flex flex-col gap-2"
    >
      <Skeleton className="h-5 w-48" />
      <Skeleton className="h-16 w-full" />
    </section>
  );
}

function ConnectionContent() {
  const { authorization, connection } =
    useFellowshipLogsConnectionStatusSuspense();
  const [isChanging, setIsChanging] = useState(false);
  const [isAwaitingOutcome, setIsAwaitingOutcome] = useState(false);
  const started = useLatestStartedFellowshipLogsAuthorization();

  if (authorization.state === "PENDING" && !isAwaitingOutcome) {
    setIsAwaitingOutcome(true);
  }

  if (isChanging && isAwaitingOutcome && authorization.state === "CONNECTED") {
    setIsChanging(false);
  }

  if (authorization.state === "PENDING") {
    return (
      <PendingAuthorization
        authorization={authorization}
        started={
          started?.profile === authorization.profile &&
          started.expiresAtMilliseconds === authorization.expiresAtMilliseconds
            ? started
            : null
        }
      />
    );
  }

  if (connection === null || isChanging) {
    return (
      <ConnectionChooser
        authorization={authorization}
        currentConnection={connection}
        onCancel={
          connection === null
            ? null
            : () => {
                setIsChanging(false);
                setIsAwaitingOutcome(false);
              }
        }
        showOutcome={isAwaitingOutcome}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {isAwaitingOutcome ? (
        <AuthorizationOutcome authorization={authorization} />
      ) : null}
      <ConnectedConnection
        connection={connection}
        onChangeConnection={() => {
          setIsChanging(true);
          setIsAwaitingOutcome(false);
        }}
      />
    </div>
  );
}
