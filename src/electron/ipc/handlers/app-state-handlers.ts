import * as E from "effect/Effect";
import * as Match from "effect/Match";
import * as Schema from "effect/Schema";

import { AppStateApiService } from "@/contracts/app-state/app-state-api-service.ts";
import { AppStateRpcRequestSchema } from "@/contracts/app-state/app-state-rpc.ts";

export function handleAppStateRequest(input: unknown) {
  return E.gen(function* () {
    const service = yield* AppStateApiService;
    const request = yield* Schema.decodeUnknownEffect(AppStateRpcRequestSchema)(
      input,
    );

    return yield* Match.value(request).pipe(
      Match.tagsExhaustive({
        GetDungeonRunComparisonGroup: () =>
          service.getDungeonRunComparisonGroup,
        GetDungeonRunTimeColumns: () => service.getDungeonRunTimeColumns,
        GetSelectedConfigurationId: () => service.getSelectedConfigurationId,
        GetSidebarOpen: () => service.getSidebarOpen,
        GetTheme: () => service.getTheme,
        SetDungeonRunComparisonGroup: ({ comparisonGroup }) =>
          service.setDungeonRunComparisonGroup(comparisonGroup),
        SetDungeonRunTimeColumns: ({ timeColumns }) =>
          service.setDungeonRunTimeColumns(timeColumns),
        SetSelectedConfigurationId: ({ selectedConfigurationId }) =>
          service.setSelectedConfigurationId(selectedConfigurationId),
        SetSidebarOpen: ({ sidebarOpen }) =>
          service.setSidebarOpen(sidebarOpen),
        SetTheme: ({ theme }) => service.setTheme(theme),
      }),
    );
  });
}
