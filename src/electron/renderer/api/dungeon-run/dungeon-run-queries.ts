import { queryOptions, useQueryClient } from "@tanstack/react-query";
import { useCallback } from "react";

import { getDungeonRunHistory } from "@/electron/renderer/api/dungeon-run/dungeon-run-client.ts";
import { browserRuntime } from "@/electron/renderer/runtimes/browser-runtime.ts";
import { type DungeonId } from "@/services/fellowship/validation/fellowship-common.ts";

export const DUNGEON_RUN_HISTORY_QUERY_KEY_PREFIX = ["dungeon-run", "history"];

type DungeonRunHistoryQueryOptionsArgs = {
  readonly dungeonId: DungeonId;
  readonly dungeonLevel: number;
};

export function getDungeonRunHistoryQueryOptions({
  dungeonId,
  dungeonLevel,
}: DungeonRunHistoryQueryOptionsArgs) {
  return queryOptions({
    queryFn: () => {
      return browserRuntime.runPromise(
        getDungeonRunHistory({
          dungeonId,
          dungeonLevel,
        }),
      );
    },
    queryKey: [
      ...DUNGEON_RUN_HISTORY_QUERY_KEY_PREFIX,
      dungeonId,
      dungeonLevel,
    ],
    staleTime: Infinity,
  });
}

export function useInvalidateDungeonRunHistory(): () => void {
  const queryClient = useQueryClient();

  return useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: DUNGEON_RUN_HISTORY_QUERY_KEY_PREFIX,
    });
  }, [queryClient]);
}
