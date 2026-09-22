import { describe, expect, test } from "vitest";

import {
  TrackingApiAlreadyRunningError,
  TrackingApiConfigurationNotFoundError,
} from "@frt/api-contract/errors/tracking-api-error.ts";
import { MOCK_CONFIGURATION_ID } from "@frt/db/tests/common/fixtures/configuration-fixtures.ts";

import { getTrackingActionErrorMessage } from "@/renderer/components/dashboard/get-tracking-action-error-message.ts";

describe("getTrackingActionErrorMessage", () => {
  test("shows the API's message when a start fails", () => {
    const message = getTrackingActionErrorMessage({
      isTrackingActive: false,
      startError: new TrackingApiConfigurationNotFoundError({
        configurationId: MOCK_CONFIGURATION_ID,
      }),
      stopError: undefined,
    });

    expect(message).toBe("The selected configuration could not be found.");
  });

  test("falls back to a general message for other start failures", () => {
    const message = getTrackingActionErrorMessage({
      isTrackingActive: false,
      startError: new Error("fetch failed"),
      stopError: undefined,
    });

    expect(message).toBe("Tracking could not be started.");
  });

  test("hides a failed start once tracking is active", () => {
    const message = getTrackingActionErrorMessage({
      isTrackingActive: true,
      startError: new TrackingApiAlreadyRunningError(),
      stopError: undefined,
    });

    expect(message).toBeUndefined();
  });

  test("shows a failed stop while tracking is still active", () => {
    const message = getTrackingActionErrorMessage({
      isTrackingActive: true,
      startError: undefined,
      stopError: new Error("fetch failed"),
    });

    expect(message).toBe("Tracking could not be stopped.");
  });

  test("hides a failed stop once tracking has stopped", () => {
    const message = getTrackingActionErrorMessage({
      isTrackingActive: false,
      startError: undefined,
      stopError: new Error("fetch failed"),
    });

    expect(message).toBeUndefined();
  });
});
