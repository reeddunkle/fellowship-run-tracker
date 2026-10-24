import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as E from "effect/Effect";
import * as HttpApiError from "effect/http-api/HttpApiError";
import { afterEach, describe, expect, test, vi } from "vitest";
import { render } from "vitest-browser-react";

import { type FellowshipLogsApiConnectionStatus } from "@frt/shared/fellowship-logs/fellowship-logs-connection-api-schema.ts";
import {
  FELLOWSHIP_LOGS_POINT_POLICY_VERSION,
  FellowshipLogsConnectedUserNameSchema,
  FellowshipLogsConnectionGenerationSchema,
} from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";

import { getBackgroundJobsQueryOptions } from "@/renderer/api/background-job/background-job-queries.ts";
import { getFellowshipLogsConnectionStatusQueryOptions } from "@/renderer/api/fellowship-logs-connection/fellowship-logs-connection-queries.ts";
import { ResumeImportWithCurrentConnection } from "@/renderer/components/fellowship-logs/resume-import-with-current-connection.tsx";
import { makeImportJob } from "@/tests/common/fixtures/background-job-fixtures.ts";

const fellowshipLogsClient = vi.hoisted(() => {
  return { resumeImportJobWithCurrentConnection: vi.fn() };
});

vi.mock(
  "@/renderer/api/fellowship-logs/fellowship-logs-client.ts",
  async (importOriginal) => {
    return {
      ...(await importOriginal<object>()),
      ...fellowshipLogsClient,
    };
  },
);

const HELD_JOB = makeImportJob("held-job", "WAITING", {
  availableAtMilliseconds: null,
  waitingReason: "PROFILE_CHANGE_CONFIRMATION_REQUIRED",
});

const CONNECTED_STATUS: FellowshipLogsApiConnectionStatus = {
  authorization: { state: "IDLE" },
  connection: {
    clientId: null,
    connectedUserName: FellowshipLogsConnectedUserNameSchema.make("Player"),
    generation: FellowshipLogsConnectionGenerationSchema.make(
      "7c3f4a1e-2b5d-4c8e-9f60-1a2b3c4d5e6f",
    ),
    pointPolicyVersion: FELLOWSHIP_LOGS_POINT_POLICY_VERSION,
    profile: "FELLOWSHIP_RUN_TRACKER_USER",
    spending: "USER_POINTS_ONLY",
    status: "CONNECTED",
    storageProtection: "OS_BACKED",
  },
};

function renderControl(status: FellowshipLogsApiConnectionStatus) {
  const client = new QueryClient({
    defaultOptions: { mutations: { retry: false }, queries: { retry: false } },
  });

  client.setQueryData(
    getFellowshipLogsConnectionStatusQueryOptions().queryKey,
    status,
  );
  client.setQueryData(getBackgroundJobsQueryOptions().queryKey, {
    jobs: [HELD_JOB],
    revision: 1,
    sessionId: "session",
  });

  const screen = render(
    <QueryClientProvider client={client}>
      <ResumeImportWithCurrentConnection jobId={HELD_JOB.id} />
    </QueryClientProvider>,
  );

  return { client, screen };
}

afterEach(() => {
  vi.resetAllMocks();
});

describe("ResumeImportWithCurrentConnection", () => {
  test("confirms the new spending policy and estimate exclusion before resuming", async () => {
    const resumedJob = { ...HELD_JOB, status: "QUEUED" as const };

    fellowshipLogsClient.resumeImportJobWithCurrentConnection.mockImplementation(
      () => E.succeed(resumedJob),
    );

    const { client, screen: pendingScreen } = renderControl(CONNECTED_STATUS);
    const screen = await pendingScreen;

    await screen
      .getByRole("button", { name: "Continue with current connection" })
      .click();

    const dialog = screen.getByRole("alertdialog", {
      name: "Continue with Connect with Fellowship Logs as Player?",
    });

    await expect.element(dialog).toBeVisible();
    await expect
      .element(dialog)
      .toHaveAccessibleDescription(
        /From now on it uses your account points\. Points used after this change won't count toward your import cost estimate\./u,
      );
    expect(
      fellowshipLogsClient.resumeImportJobWithCurrentConnection,
    ).not.toHaveBeenCalled();

    await screen.getByRole("button", { name: "Continue import" }).click();

    await expect.element(dialog).not.toBeInTheDocument();
    expect(
      fellowshipLogsClient.resumeImportJobWithCurrentConnection,
    ).toHaveBeenCalledWith({ jobId: HELD_JOB.id });
    expect(
      client.getQueryData(getBackgroundJobsQueryOptions().queryKey)?.jobs,
    ).toEqual([resumedJob]);
    await screen.unmount();
  });

  test("returns focus to the trigger when the user declines", async () => {
    const screen = await renderControl(CONNECTED_STATUS).screen;
    const trigger = screen.getByRole("button", {
      name: "Continue with current connection",
    });

    await trigger.click();
    await screen.getByRole("button", { name: "Not now" }).click();

    await expect.element(trigger).toHaveFocus();
    expect(
      fellowshipLogsClient.resumeImportJobWithCurrentConnection,
    ).not.toHaveBeenCalled();
    await screen.unmount();
  });

  test("explains when the job is no longer held", async () => {
    fellowshipLogsClient.resumeImportJobWithCurrentConnection.mockImplementation(
      () => E.fail(new HttpApiError.NotFound({})),
    );

    const screen = await renderControl(CONNECTED_STATUS).screen;

    await screen
      .getByRole("button", { name: "Continue with current connection" })
      .click();
    await screen.getByRole("button", { name: "Continue import" }).click();

    await expect
      .element(screen.getByRole("alert"))
      .toHaveTextContent("This import is no longer waiting for confirmation.");
    await screen.unmount();
  });

  test("asks for a connection instead of offering to continue while disconnected", async () => {
    const screen = await renderControl({
      authorization: { state: "IDLE" },
      connection: null,
    }).screen;

    await expect
      .element(
        screen.getByText("Connect to Fellowship Logs above to continue it."),
      )
      .toBeVisible();
    await expect
      .element(
        screen.getByRole("button", {
          name: "Continue with current connection",
        }),
      )
      .not.toBeInTheDocument();
    await screen.unmount();
  });
});
