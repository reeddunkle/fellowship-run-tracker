import { QueryClient } from "@tanstack/react-query";
import { describe, expect, test, vi } from "vitest";

import { primeAppStateQueries } from "@/electron/renderer/api/app-state/app-state-queries.ts";
import { DEFAULT_APP_STATE } from "@/electron/storage/app-state/app-state-schema.ts";

describe("app-state queries", () => {
  test("primes renderer state with granular requests", async () => {
    const request = vi.fn((input: { readonly _tag: string }) => {
      const responses: Record<string, unknown> = {
        GetDungeonRunComparisonGroup:
          DEFAULT_APP_STATE.dungeonRun.comparisonGroup,
        GetDungeonRunTimeColumns: DEFAULT_APP_STATE.dungeonRun.timeColumns,
        GetSelectedConfigurationId: DEFAULT_APP_STATE.selectedConfigurationId,
        GetSidebarOpen: DEFAULT_APP_STATE.sidebarOpen,
        GetTheme: DEFAULT_APP_STATE.theme,
      };

      return Promise.resolve(responses[input._tag]);
    });
    const originalElectronApi = Object.getOwnPropertyDescriptor(
      window,
      "electronAPI",
    );
    Object.defineProperty(window, "electronAPI", {
      configurable: true,
      value: { appState: { request } },
    });

    try {
      await primeAppStateQueries(new QueryClient());

      expect(request.mock.calls.map(([input]) => input._tag).sort()).toEqual([
        "GetDungeonRunComparisonGroup",
        "GetDungeonRunTimeColumns",
        "GetSelectedConfigurationId",
        "GetSidebarOpen",
        "GetTheme",
      ]);
    } finally {
      if (originalElectronApi === undefined) {
        Reflect.deleteProperty(window, "electronAPI");
      } else {
        Object.defineProperty(window, "electronAPI", originalElectronApi);
      }
    }
  });
});
