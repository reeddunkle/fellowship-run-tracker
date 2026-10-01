import { QueryClient } from "@tanstack/react-query";
import { describe, expect, test } from "vitest";

import { MOCK_CONFIGURATION_ID } from "@frt/db/tests/common/fixtures/configuration-fixtures.ts";
import {
  type AppStateValue,
  DUNGEON_RUN_TIME_COLUMN,
} from "@frt/shared/app-state/app-state-schema.ts";

import {
  getDungeonRunComparisonGroupQueryOptions,
  getDungeonRunTimeColumnsQueryOptions,
  getSelectedConfigurationIdQueryOptions,
  getSidebarOpenQueryOptions,
  getThemeQueryOptions,
  primeAppStateQueries,
} from "@/renderer/api/app-state/app-state-queries.ts";

const STORED_APP_STATE: AppStateValue = {
  dungeonRun: {
    comparisonGroup: "COMPARISON",
    timeColumns: [
      {
        column: DUNGEON_RUN_TIME_COLUMN.TOTAL,
        displayOrder: 0,
        isVisible: false,
      },
    ],
  },
  selectedConfigurationId: MOCK_CONFIGURATION_ID,
  sidebarOpen: false,
  theme: "light",
};

describe("app-state queries", () => {
  test("primes each renderer state query with its stored value", async () => {
    const responses: Record<string, unknown> = {
      GetDungeonRunComparisonGroup: STORED_APP_STATE.dungeonRun.comparisonGroup,
      GetDungeonRunTimeColumns: STORED_APP_STATE.dungeonRun.timeColumns,
      GetSelectedConfigurationId: STORED_APP_STATE.selectedConfigurationId,
      GetSidebarOpen: STORED_APP_STATE.sidebarOpen,
      GetTheme: STORED_APP_STATE.theme,
    };
    const originalElectronApi = Object.getOwnPropertyDescriptor(
      window,
      "electronAPI",
    );
    Object.defineProperty(window, "electronAPI", {
      configurable: true,
      value: {
        appState: {
          request: (input: { readonly _tag: string }) => {
            return Promise.resolve(responses[input._tag]);
          },
        },
      },
    });

    try {
      const queryClient = new QueryClient();

      await primeAppStateQueries(queryClient);

      expect(queryClient.getQueryData(getThemeQueryOptions().queryKey)).toBe(
        STORED_APP_STATE.theme,
      );
      expect(
        queryClient.getQueryData(getSidebarOpenQueryOptions().queryKey),
      ).toBe(STORED_APP_STATE.sidebarOpen);
      expect(
        queryClient.getQueryData(
          getSelectedConfigurationIdQueryOptions().queryKey,
        ),
      ).toBe(STORED_APP_STATE.selectedConfigurationId);
      expect(
        queryClient.getQueryData(
          getDungeonRunTimeColumnsQueryOptions().queryKey,
        ),
      ).toEqual(STORED_APP_STATE.dungeonRun.timeColumns);
      expect(
        queryClient.getQueryData(
          getDungeonRunComparisonGroupQueryOptions().queryKey,
        ),
      ).toBe(STORED_APP_STATE.dungeonRun.comparisonGroup);
    } finally {
      if (originalElectronApi === undefined) {
        Reflect.deleteProperty(window, "electronAPI");
      } else {
        Object.defineProperty(window, "electronAPI", originalElectronApi);
      }
    }
  });
});
