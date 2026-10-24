import * as Redacted from "effect/Redacted";
import { LogInIcon } from "lucide-react";
import { useState } from "react";

import {
  type FellowshipLogsApiAuthorizationStatus,
  type FellowshipLogsApiConnection,
  type FellowshipLogsApiSaveOwnClientOptions,
  type FellowshipLogsApiStartAuthorizationOptions,
} from "@frt/shared/fellowship-logs/fellowship-logs-connection-api-schema.ts";
import { type FellowshipLogsConnectionProfile } from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";
import { Badge } from "@frt/ui/primitives/badge.tsx";
import { Button } from "@frt/ui/primitives/button.tsx";
import { RadioGroup, RadioGroupItem } from "@frt/ui/primitives/radio-group.tsx";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@frt/ui/primitives/tabs.tsx";

import {
  useSaveFellowshipLogsOwnClient,
  useStartFellowshipLogsAuthorization,
} from "@/renderer/api/fellowship-logs-connection/fellowship-logs-connection-mutations.ts";
import { HowPointsWorkButton } from "@/renderer/components/fellowship-logs/fellowship-logs-points-section.tsx";

import { AuthorizationOutcome } from "./authorization-outcome.tsx";
import { ConnectionCommandFeedback } from "./connection-command-feedback.tsx";
import { DisconnectControl } from "./disconnect-control.tsx";
import { FELLOWSHIP_LOGS_PROFILE_COPY } from "./fellowship-logs-connection-copy.ts";
import { OwnApiClientForm, OwnClientSignInForm } from "./own-client-forms.tsx";
import { useConnectionCommand } from "./use-connection-command.ts";

type ConnectionChooserProps = {
  readonly authorization: FellowshipLogsApiAuthorizationStatus;
  readonly currentConnection: FellowshipLogsApiConnection | null;
  readonly onCancel: (() => void) | null;
  readonly showOutcome: boolean;
};

type ConnectionTab = "advanced" | "basic";

type AdvancedProfile = Extract<
  FellowshipLogsConnectionProfile,
  "OWN_CLIENT" | "OWN_CLIENT_USER"
>;

function ProfileDetails({
  profile,
}: {
  readonly profile: FellowshipLogsConnectionProfile;
}) {
  const copy = FELLOWSHIP_LOGS_PROFILE_COPY[profile];

  return (
    <div className="flex flex-col gap-2 text-sm">
      <p>
        {copy.pointUsage} <HowPointsWorkButton />
      </p>
      <ul className="list-disc pl-5 text-muted-foreground">
        {copy.facts.map((fact) => (
          <li key={fact}>{fact}</li>
        ))}
      </ul>
    </div>
  );
}

export function ConnectionChooser({
  authorization,
  currentConnection,
  onCancel,
  showOutcome,
}: ConnectionChooserProps) {
  const startMutation = useStartFellowshipLogsAuthorization();
  const saveMutation = useSaveFellowshipLogsOwnClient();
  const [activeTab, setActiveTab] = useState<ConnectionTab>(
    currentConnection === null ||
      currentConnection.profile === "FELLOWSHIP_RUN_TRACKER_USER"
      ? "basic"
      : "advanced",
  );
  const [advancedProfile, setAdvancedProfile] = useState<AdvancedProfile>(
    currentConnection?.profile === "OWN_CLIENT"
      ? "OWN_CLIENT"
      : "OWN_CLIENT_USER",
  );

  const startCommand = useConnectionCommand(
    (options: FellowshipLogsApiStartAuthorizationOptions) => {
      saveMutation.reset();
      startMutation.mutate(options);
    },
  );
  const saveCommand = useConnectionCommand(
    (options: FellowshipLogsApiSaveOwnClientOptions) => {
      startMutation.reset();
      saveMutation.mutate(options, {
        onSuccess: () => {
          onCancel?.();
        },
      });
    },
  );

  const isPending = startMutation.isPending || saveMutation.isPending;
  const expectedGeneration =
    currentConnection === null ? null : currentConnection.generation;

  return (
    <div className="flex flex-col gap-4">
      {showOutcome ? (
        <AuthorizationOutcome authorization={authorization} />
      ) : null}
      <ConnectionCommandFeedback
        error={startMutation.error}
        isPending={isPending}
        onRetry={startCommand.retry}
      />
      <ConnectionCommandFeedback
        error={saveMutation.error}
        isPending={isPending}
        onRetry={saveCommand.retry}
      />
      <Tabs
        onValueChange={(value) => {
          if (value === "advanced" || value === "basic") {
            setActiveTab(value);
          }
        }}
        value={activeTab}
      >
        <TabsList>
          <TabsTrigger value="basic">
            Basic
            <Badge variant="secondary">Recommended</Badge>
          </TabsTrigger>
          <TabsTrigger value="advanced">Advanced</TabsTrigger>
        </TabsList>
        <TabsContent value="basic">
          <section
            aria-labelledby="fellowship-logs-basic-profile"
            className="flex flex-col gap-3 rounded-md border p-4"
          >
            <div className="flex flex-col gap-1">
              <h3
                className="text-sm font-medium"
                id="fellowship-logs-basic-profile"
              >
                {FELLOWSHIP_LOGS_PROFILE_COPY.FELLOWSHIP_RUN_TRACKER_USER.title}
              </h3>
              <p className="text-sm text-muted-foreground">
                Sign in with Fellowship Logs in your browser. This is the
                easiest option and can import public reports and private reports
                your account can view.
              </p>
            </div>
            <ProfileDetails profile="FELLOWSHIP_RUN_TRACKER_USER" />
            <div>
              <Button
                disabled={isPending}
                onClick={() => {
                  startCommand.run({
                    allowLocalFallback: false,
                    expectedGeneration,
                    profile: "FELLOWSHIP_RUN_TRACKER_USER",
                    replaceConnection: false,
                  });
                }}
                type="button"
              >
                <LogInIcon />
                Sign in with Fellowship Logs
              </Button>
            </div>
          </section>
        </TabsContent>
        <TabsContent value="advanced">
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              Use an API client you created on Fellowship Logs. This takes extra
              setup and gives the client a separate hourly point limit.
            </p>
            <RadioGroup
              aria-label="Advanced connection method"
              onValueChange={(value) => {
                if (value === "OWN_CLIENT" || value === "OWN_CLIENT_USER") {
                  setAdvancedProfile(value);
                }
              }}
              value={advancedProfile}
            >
              <label
                className={
                  advancedProfile === "OWN_CLIENT_USER"
                    ? "flex cursor-pointer items-start gap-3 rounded-md border border-primary bg-primary/5 p-3"
                    : "flex cursor-pointer items-start gap-3 rounded-md border p-3"
                }
                htmlFor="fellowship-logs-own-client-user-choice"
              >
                <RadioGroupItem
                  id="fellowship-logs-own-client-user-choice"
                  value="OWN_CLIENT_USER"
                />
                <span className="flex flex-col gap-1">
                  <span className="text-sm font-medium">
                    {FELLOWSHIP_LOGS_PROFILE_COPY.OWN_CLIENT_USER.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Best if you want to import private reports.
                  </span>
                </span>
              </label>
              <label
                className={
                  advancedProfile === "OWN_CLIENT"
                    ? "flex cursor-pointer items-start gap-3 rounded-md border border-primary bg-primary/5 p-3"
                    : "flex cursor-pointer items-start gap-3 rounded-md border p-3"
                }
                htmlFor="fellowship-logs-own-client-choice"
              >
                <RadioGroupItem
                  id="fellowship-logs-own-client-choice"
                  value="OWN_CLIENT"
                />
                <span className="flex flex-col gap-1">
                  <span className="text-sm font-medium">
                    {FELLOWSHIP_LOGS_PROFILE_COPY.OWN_CLIENT.title}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    Public reports only.
                  </span>
                </span>
              </label>
            </RadioGroup>
            <section
              aria-label={`${FELLOWSHIP_LOGS_PROFILE_COPY[advancedProfile].title} details`}
              className="flex flex-col gap-3 rounded-md border p-4"
            >
              <p className="text-sm">
                {FELLOWSHIP_LOGS_PROFILE_COPY[advancedProfile].summary}
              </p>
              <ProfileDetails profile={advancedProfile} />
              {advancedProfile === "OWN_CLIENT_USER" ? (
                <OwnClientSignInForm
                  initialClientId={
                    currentConnection?.profile === "OWN_CLIENT_USER"
                      ? currentConnection.clientId
                      : null
                  }
                  isPending={isPending}
                  onSubmit={(clientId) => {
                    startCommand.run({
                      allowLocalFallback: false,
                      clientId,
                      expectedGeneration,
                      profile: "OWN_CLIENT_USER",
                      replaceConnection: false,
                    });
                  }}
                />
              ) : (
                <OwnApiClientForm
                  isPending={isPending}
                  onSubmit={({ clientId, clientSecret }) => {
                    saveCommand.run({
                      allowLocalFallback: false,
                      clientId,
                      clientSecret: Redacted.make(clientSecret),
                      expectedGeneration,
                      replaceConnection: false,
                    });
                  }}
                />
              )}
            </section>
          </div>
        </TabsContent>
      </Tabs>
      {onCancel === null || currentConnection === null ? null : (
        <div className="flex flex-wrap gap-2 border-t pt-4">
          <DisconnectControl />
          <Button onClick={onCancel} type="button" variant="ghost">
            Cancel change connection
          </Button>
        </div>
      )}
    </div>
  );
}
