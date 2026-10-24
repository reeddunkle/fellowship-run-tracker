import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as DateTime from "effect/DateTime";
import * as E from "effect/Effect";
import * as Redacted from "effect/Redacted";
import { afterEach, describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

import {
  FellowshipLogsApiConnectionChangedError,
  FellowshipLogsApiConnectionReplacementConfirmationRequiredError,
  FellowshipLogsApiInvalidCredentialsError,
  FellowshipLogsApiLocalProtectionAcknowledgementRequiredError,
} from "@frt/api-contract/errors/fellowship-logs-api-error.ts";
import { FellowshipLogsClientIdSchema } from "@frt/shared/fellowship-logs/fellowship-logs-client-credentials-schema.ts";
import {
  type FellowshipLogsApiConnection,
  type FellowshipLogsApiConnectionStatus,
  type FellowshipLogsApiStartAuthorizationOptions,
} from "@frt/shared/fellowship-logs/fellowship-logs-connection-api-schema.ts";
import {
  FELLOWSHIP_LOGS_POINT_POLICY_VERSION,
  FellowshipLogsConnectedUserNameSchema,
  FellowshipLogsConnectionGenerationSchema,
} from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";

import {
  getFellowshipLogsImportCostEstimateQueryOptions,
  getFellowshipLogsPointPoolsQueryOptions,
} from "@/renderer/api/fellowship-logs/fellowship-logs-queries.ts";
import { getFellowshipLogsConnectionStatusQueryOptions } from "@/renderer/api/fellowship-logs-connection/fellowship-logs-connection-queries.ts";
import { FellowshipLogsConnectionSection } from "@/renderer/components/fellowship-logs/connection/fellowship-logs-connection-section.tsx";
import { FellowshipLogsPointsDialog } from "@/renderer/components/fellowship-logs/fellowship-logs-points-section.tsx";

const connectionClient = vi.hoisted(() => {
  return {
    cancelAuthorization: vi.fn(),
    checkPointSystemOptIn: vi.fn(),
    completeAuthorization: vi.fn(),
    disconnect: vi.fn(),
    getConnectionStatus: vi.fn(),
    saveOwnClient: vi.fn(),
    startAuthorization: vi.fn(),
  };
});

vi.mock(
  "@/renderer/api/fellowship-logs-connection/fellowship-logs-connection-client.ts",
  () => connectionClient,
);

const IDLE_STATUS: FellowshipLogsApiConnectionStatus = {
  authorization: { state: "IDLE" },
  connection: null,
};

const OWN_CLIENT_CONNECTION: FellowshipLogsApiConnection = {
  clientId: FellowshipLogsClientIdSchema.make("own-client-id"),
  connectedUserName: null,
  generation: FellowshipLogsConnectionGenerationSchema.make(
    "7c3f4a1e-2b5d-4c8e-9f60-1a2b3c4d5e6f",
  ),
  pointPolicyVersion: FELLOWSHIP_LOGS_POINT_POLICY_VERSION,
  profile: "OWN_CLIENT",
  spending: "DEFAULT",
  status: "CONNECTED",
  storageProtection: "OS_BACKED",
};

const OWN_CLIENT_USER_CONNECTION: FellowshipLogsApiConnection = {
  ...OWN_CLIENT_CONNECTION,
  connectedUserName: FellowshipLogsConnectedUserNameSchema.make("Player Name"),
  profile: "OWN_CLIENT_USER",
  spending: "DEFAULT",
};

const OPT_IN_REQUIRED_CONNECTION: FellowshipLogsApiConnection = {
  clientId: null,
  connectedUserName: FellowshipLogsConnectedUserNameSchema.make("Player Name"),
  generation: FellowshipLogsConnectionGenerationSchema.make(
    "0d9e8f7a-6b5c-4d3e-a2f1-0e9d8c7b6a5f",
  ),
  pointPolicyVersion: FELLOWSHIP_LOGS_POINT_POLICY_VERSION,
  profile: "FELLOWSHIP_RUN_TRACKER_USER",
  spending: "USER_POINTS_ONLY",
  status: "POINT_SYSTEM_OPT_IN_REQUIRED",
  storageProtection: "OS_BACKED",
};

const CONNECTED_BASIC_CONNECTION: FellowshipLogsApiConnection = {
  ...OPT_IN_REQUIRED_CONNECTION,
  status: "CONNECTED",
};

const REAUTHORIZATION_REQUIRED_CONNECTION: FellowshipLogsApiConnection = {
  ...OPT_IN_REQUIRED_CONNECTION,
  status: "REAUTHORIZATION_REQUIRED",
};

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });
}

function renderWithClient(client: QueryClient) {
  return render(
    <QueryClientProvider client={client}>
      <FellowshipLogsPointsDialog>
        <FellowshipLogsConnectionSection />
      </FellowshipLogsPointsDialog>
    </QueryClientProvider>,
  );
}

function renderSection(
  status: FellowshipLogsApiConnectionStatus,
  client = makeQueryClient(),
) {
  client.setQueryData(
    getFellowshipLogsConnectionStatusQueryOptions().queryKey,
    status,
  );
  connectionClient.getConnectionStatus.mockImplementation(() =>
    E.succeed(status),
  );

  return renderWithClient(client);
}

function makePendingStatus(
  expiresAtMilliseconds = DateTime.toEpochMillis(DateTime.nowUnsafe()) +
    9 * 60_000,
): FellowshipLogsApiConnectionStatus {
  return {
    authorization: {
      expiresAtMilliseconds,
      profile: "FELLOWSHIP_RUN_TRACKER_USER",
      state: "PENDING",
    },
    connection: null,
  };
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("FellowshipLogsConnectionSection", () => {
  test("leads with Basic and shows one Advanced setup method at a time", async () => {
    const screen = await renderSection(IDLE_STATUS);

    await expect
      .element(
        screen.getByRole("heading", { name: "Connect with Fellowship Logs" }),
      )
      .toBeVisible();
    await expect
      .element(screen.getByRole("tab", { name: /Basic/iu }))
      .toHaveAttribute("aria-selected", "true");
    await expect
      .element(screen.getByText("Opt into the new point system"))
      .not.toBeInTheDocument();
    await expect
      .element(screen.getByRole("textbox", { name: "Client ID" }))
      .not.toBeInTheDocument();

    await screen.getByRole("tab", { name: "Advanced" }).click();

    await expect
      .element(
        screen.getByRole("radio", { name: /Sign in with my API client/iu }),
      )
      .toBeVisible();
    await expect
      .element(
        screen.getByRole("radio", {
          name: /Use my API client credentials/iu,
        }),
      )
      .toBeVisible();
    await expect
      .element(screen.getByText(/Enable Public Client/iu))
      .toBeVisible();
    await expect
      .element(screen.getByText("http://127.0.0.1:47892/oauth/callback"))
      .toBeVisible();
    await expect
      .element(screen.getByRole("textbox", { name: "Public client ID" }))
      .toBeVisible();
    await expect
      .element(screen.getByLabelText("Client secret"))
      .not.toBeInTheDocument();
    await screen.unmount();
  });

  test("keeps healthy connection actions compact", async () => {
    const screen = await renderSection({
      authorization: { state: "IDLE" },
      connection: CONNECTED_BASIC_CONNECTION,
    });

    await expect
      .element(screen.getByRole("button", { name: "Change connection" }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: "Sign in again" }))
      .not.toBeInTheDocument();
    await expect
      .element(
        screen.getByRole("button", {
          name: "Disconnect from Fellowship Logs",
        }),
      )
      .not.toBeInTheDocument();
    await screen.unmount();
  });

  test("keeps reauthentication directly available", async () => {
    const screen = await renderSection({
      authorization: { state: "IDLE" },
      connection: REAUTHORIZATION_REQUIRED_CONNECTION,
    });

    await expect
      .element(screen.getByRole("button", { name: "Sign in again" }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: "Change connection" }))
      .toBeVisible();
    await screen.unmount();
  });

  test("prefills the saved public client ID while changing connections", async () => {
    const screen = await renderSection({
      authorization: { state: "IDLE" },
      connection: OWN_CLIENT_USER_CONNECTION,
    });

    await screen.getByRole("button", { name: "Change connection" }).click();

    await expect
      .element(screen.getByRole("textbox", { name: "Public client ID" }))
      .toHaveValue("own-client-id");
    await expect
      .element(screen.getByRole("button", { name: "Cancel change connection" }))
      .toBeVisible();
    await screen
      .getByRole("button", { name: "Cancel change connection" })
      .click();
    await expect
      .element(screen.getByText("Signed in as Player Name"))
      .toBeVisible();
    await screen.unmount();
  });

  test("does not offer to save rejected client credentials", async () => {
    connectionClient.saveOwnClient.mockImplementation(() =>
      E.fail(new FellowshipLogsApiInvalidCredentialsError()),
    );
    const screen = await renderSection(IDLE_STATUS);

    await screen.getByRole("tab", { name: "Advanced" }).click();
    await screen
      .getByRole("radio", { name: /Use my API client credentials/iu })
      .click();
    await screen.getByRole("textbox", { name: "Client ID" }).fill("client-id");
    await screen.getByLabelText("Client secret").fill("client-secret");
    await screen.getByRole("button", { name: "Check and save client" }).click();

    await expect
      .element(
        screen.getByText(
          "Fellowship Logs didn't accept that client ID and secret.",
        ),
      )
      .toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: /save anyway/iu }))
      .not.toBeInTheDocument();
    await screen.unmount();
  });

  test("asks before replacing a connection or using local encryption, then retries with both", async () => {
    const sentOptions: Array<FellowshipLogsApiStartAuthorizationOptions> = [];

    connectionClient.startAuthorization.mockImplementation(
      (options: FellowshipLogsApiStartAuthorizationOptions) => {
        sentOptions.push(options);

        if (!options.replaceConnection) {
          return E.fail(
            new FellowshipLogsApiConnectionReplacementConfirmationRequiredError(
              { currentProfile: "OWN_CLIENT" },
            ),
          );
        }

        if (!options.allowLocalFallback) {
          return E.fail(
            new FellowshipLogsApiLocalProtectionAcknowledgementRequiredError(),
          );
        }

        return E.succeed({
          authorizationUrl: "https://www.fellowshiplogs.com/oauth/authorize",
          browserLaunch: "OPENED",
          expiresAtMilliseconds:
            DateTime.toEpochMillis(DateTime.nowUnsafe()) + 600_000,
          profile: options.profile,
          storageProtection: "LOCAL_KEY",
        });
      },
    );

    const screen = await renderSection({
      authorization: { state: "IDLE" },
      connection: OWN_CLIENT_CONNECTION,
    });

    await screen.getByRole("button", { name: "Change connection" }).click();
    await screen.getByRole("tab", { name: /Basic/iu }).click();
    await screen
      .getByRole("button", { name: "Sign in with Fellowship Logs" })
      .click();

    await expect
      .element(screen.getByText("Replace your current connection?"))
      .toBeVisible();
    await expect
      .element(screen.getByText(/replaces your Use my API client credentials/u))
      .toBeVisible();

    await screen.getByRole("button", { name: "Replace connection" }).click();

    await expect
      .element(screen.getByText("Secure system storage isn't available"))
      .toBeVisible();

    await screen.getByRole("button", { name: "Use local encryption" }).click();

    await expect.poll(() => sentOptions.length).toBe(3);
    expect(sentOptions).toEqual([
      {
        allowLocalFallback: false,
        expectedGeneration: OWN_CLIENT_CONNECTION.generation,
        profile: "FELLOWSHIP_RUN_TRACKER_USER",
        replaceConnection: false,
      },
      {
        allowLocalFallback: false,
        expectedGeneration: OWN_CLIENT_CONNECTION.generation,
        profile: "FELLOWSHIP_RUN_TRACKER_USER",
        replaceConnection: true,
      },
      {
        allowLocalFallback: true,
        expectedGeneration: OWN_CLIENT_CONNECTION.generation,
        profile: "FELLOWSHIP_RUN_TRACKER_USER",
        replaceConnection: true,
      },
    ]);
    await screen.unmount();
  });

  test("says the connection changed when a sign-in confirmed an older one", async () => {
    const sentOptions: Array<FellowshipLogsApiStartAuthorizationOptions> = [];

    connectionClient.startAuthorization.mockImplementation(
      (options: FellowshipLogsApiStartAuthorizationOptions) => {
        sentOptions.push(options);

        return E.fail(new FellowshipLogsApiConnectionChangedError());
      },
    );

    const screen = await renderSection(IDLE_STATUS);

    await screen
      .getByRole("button", { name: "Sign in with Fellowship Logs" })
      .click();

    await expect
      .element(
        screen.getByText(
          "Your Fellowship Logs connection changed. Review it, then try again.",
        ),
      )
      .toBeVisible();
    expect(sentOptions).toEqual([
      {
        allowLocalFallback: false,
        expectedGeneration: null,
        profile: "FELLOWSHIP_RUN_TRACKER_USER",
        replaceConnection: false,
      },
    ]);
    await screen.unmount();
  });

  test("explains a sign-in that finished after the connection changed", async () => {
    const screen = await renderSection(makePendingStatus());

    connectionClient.getConnectionStatus.mockImplementation(() =>
      E.succeed({
        authorization: {
          failure: "CONNECTION_CHANGED",
          profile: "FELLOWSHIP_RUN_TRACKER_USER",
          state: "FAILED",
        },
        connection: OWN_CLIENT_CONNECTION,
      } satisfies FellowshipLogsApiConnectionStatus),
    );

    await expect
      .element(
        screen.getByText(
          "Your Fellowship Logs connection changed while you were signing in, so nothing was replaced. Review it, then sign in again.",
        ),
        { timeout: 3_000 },
      )
      .toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: "Change connection" }))
      .toBeVisible();
    await screen.unmount();
  });

  test("offers cancel and a manual callback while a sign-in is pending", async () => {
    connectionClient.completeAuthorization.mockImplementation(() =>
      E.succeed({
        connectedUserName:
          FellowshipLogsConnectedUserNameSchema.make("Player Name"),
        pointSystemOptIn: "OPTED_IN",
        profile: "FELLOWSHIP_RUN_TRACKER_USER",
        state: "CONNECTED",
      }),
    );

    const screen = await renderSection({
      authorization: {
        expiresAtMilliseconds:
          DateTime.toEpochMillis(DateTime.nowUnsafe()) + 9 * 60_000,
        profile: "FELLOWSHIP_RUN_TRACKER_USER",
        state: "PENDING",
      },
      connection: null,
    });

    await expect
      .element(
        screen.getByText(
          "Finish signing in to Fellowship Logs in your browser.",
        ),
      )
      .toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: "Cancel sign-in" }))
      .toBeVisible();
    await expect
      .element(screen.getByRole("button", { name: "How points work" }))
      .not.toBeInTheDocument();

    const callbackUrl =
      "http://127.0.0.1:49152/oauth/callback?code=code-value&state=state-value";

    await screen
      .getByRole("textbox", { name: "Finished in another browser?" })
      .fill(callbackUrl);
    await screen.getByRole("button", { name: "Finish" }).click();

    await expect
      .poll(() => connectionClient.completeAuthorization.mock.calls.length)
      .toBe(1);

    const [options] = connectionClient.completeAuthorization.mock.calls[0] as [
      { readonly callbackUrl: Redacted.Redacted<string> },
    ];

    expect(Redacted.value(options.callbackUrl)).toBe(callbackUrl);
    await screen.unmount();
  });

  test("explains the point-system opt-in and checks again", async () => {
    connectionClient.checkPointSystemOptIn.mockImplementation(() =>
      E.succeed({ result: "OPT_IN_REQUIRED" }),
    );

    const screen = await renderSection({
      authorization: { state: "IDLE" },
      connection: OPT_IN_REQUIRED_CONNECTION,
    });

    await expect
      .element(screen.getByText("Signed in as Player Name"))
      .toBeVisible();
    await expect
      .element(
        screen.getByText("Under Web API, opt into the new point system."),
      )
      .toBeVisible();
    await expect
      .element(screen.getByRole("link", { name: "Open account settings" }))
      .toHaveAttribute("target", "_blank");

    await screen.getByRole("button", { name: "Check again" }).click();

    await expect
      .element(screen.getByText("Fellowship Logs still reports no opt-in."))
      .toBeVisible();
    await screen.unmount();
  });

  test("confirms a disconnect without claiming it revokes access on Fellowship Logs", async () => {
    connectionClient.disconnect.mockImplementation(() => E.void);

    const screen = await renderSection({
      authorization: { state: "IDLE" },
      connection: OWN_CLIENT_CONNECTION,
    });

    await screen.getByRole("button", { name: "Change connection" }).click();
    await screen
      .getByRole("button", { name: "Disconnect from Fellowship Logs" })
      .click();

    const confirmation = screen.getByRole("alertdialog", {
      name: "Disconnect from Fellowship Logs?",
    });

    await expect.element(confirmation).toBeVisible();
    expect(confirmation.element().textContent).toContain(
      "deletes the sign-in or client secret",
    );
    expect(confirmation.element().textContent).not.toContain(
      "Authorized Applications",
    );

    await confirmation.getByRole("button", { name: "Disconnect" }).click();

    await expect
      .poll(() => connectionClient.disconnect.mock.calls.length)
      .toBe(1);
    await screen.unmount();
  });

  test("doesn't show an earlier sign-in failure next to a working connection", async () => {
    const screen = await renderSection({
      authorization: {
        failure: "OWN_CLIENT_REJECTED",
        profile: "OWN_CLIENT_USER",
        state: "FAILED",
      },
      connection: OWN_CLIENT_CONNECTION,
    });

    await expect
      .element(screen.getByRole("button", { name: "Change connection" }))
      .toBeVisible();
    await expect
      .element(screen.getByText("Sign-in failed"))
      .not.toBeInTheDocument();
    await screen.unmount();
  });

  test("doesn't show an earlier sign-in failure when changing the connection", async () => {
    const screen = await renderSection({
      authorization: {
        failure: "OWN_CLIENT_REJECTED",
        profile: "OWN_CLIENT_USER",
        state: "FAILED",
      },
      connection: OWN_CLIENT_CONNECTION,
    });

    await screen.getByRole("button", { name: "Change connection" }).click();
    await screen.getByRole("tab", { name: /Basic/iu }).click();

    await expect
      .element(
        screen.getByRole("button", { name: "Sign in with Fellowship Logs" }),
      )
      .toBeVisible();
    await expect
      .element(screen.getByText("Sign-in failed"))
      .not.toBeInTheDocument();
    await screen.unmount();
  });

  test("keeps the sign-in link after leaving and returning when the browser didn't open", async () => {
    const expiresAtMilliseconds =
      DateTime.toEpochMillis(DateTime.nowUnsafe()) + 600_000;

    connectionClient.startAuthorization.mockImplementation(() => {
      connectionClient.getConnectionStatus.mockImplementation(() =>
        E.succeed(makePendingStatus(expiresAtMilliseconds)),
      );

      return E.succeed({
        authorizationUrl: "https://www.fellowshiplogs.com/oauth/authorize",
        browserLaunch: "LAUNCH_FAILED",
        expiresAtMilliseconds,
        profile: "FELLOWSHIP_RUN_TRACKER_USER",
        storageProtection: "OS_BACKED",
      });
    });

    const client = makeQueryClient();
    const screen = await renderSection(IDLE_STATUS, client);

    await screen
      .getByRole("button", { name: "Sign in with Fellowship Logs" })
      .click();

    await expect
      .element(screen.getByRole("button", { name: "Copy sign-in link" }))
      .toBeVisible();
    await screen.unmount();

    const returned = await renderWithClient(client);

    await expect
      .element(returned.getByText(/Your browser didn't open/u))
      .toBeVisible();
    await expect
      .element(returned.getByRole("button", { name: "Copy sign-in link" }))
      .toBeVisible();
    await returned.unmount();
  });

  test("says when cancelling a sign-in fails", async () => {
    connectionClient.cancelAuthorization.mockImplementation(() =>
      E.fail(
        new FellowshipLogsApiLocalProtectionAcknowledgementRequiredError(),
      ),
    );

    const screen = await renderSection(makePendingStatus());

    await screen.getByRole("button", { name: "Cancel sign-in" }).click();

    await expect
      .element(screen.getByRole("alert"))
      .toHaveTextContent("Something went wrong. Try again.");
    await screen.unmount();
  });

  test("refreshes points and import costs once a sign-in finishes in the browser", async () => {
    const client = makeQueryClient();
    const invalidateQueries = vi.spyOn(client, "invalidateQueries");
    const screen = await renderSection(makePendingStatus(), client);

    connectionClient.getConnectionStatus.mockImplementation(() =>
      E.succeed({
        authorization: {
          connectedUserName:
            FellowshipLogsConnectedUserNameSchema.make("Player Name"),
          pointSystemOptIn: "OPTED_IN",
          profile: "FELLOWSHIP_RUN_TRACKER_USER",
          state: "CONNECTED",
        },
        connection: { ...OPT_IN_REQUIRED_CONNECTION, status: "CONNECTED" },
      } satisfies FellowshipLogsApiConnectionStatus),
    );

    const invalidatedKeys = () => {
      return invalidateQueries.mock.calls.map(([filters]) => {
        return JSON.stringify(filters?.queryKey);
      });
    };

    await expect
      .poll(invalidatedKeys, { timeout: 3_000 })
      .toEqual(
        expect.arrayContaining([
          JSON.stringify(getFellowshipLogsPointPoolsQueryOptions().queryKey),
          JSON.stringify(
            getFellowshipLogsImportCostEstimateQueryOptions().queryKey,
          ),
        ]),
      );
    await screen.unmount();
  });
});
