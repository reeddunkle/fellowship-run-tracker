import {
  queryOptions,
  skipToken,
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from "@tanstack/react-query";
import * as E from "effect/Effect";
import { useCallback } from "react";

import { type DungeonRunApiHistory } from "@frt/shared/dungeon-run/dungeon-run-api-schema.ts";
import { type DungeonId } from "@frt/shared/fellowship/validation/fellowship-common.ts";

import { getDungeonRunHistory } from "@/renderer/api/dungeon-run/dungeon-run-client.ts";
import { browserRuntime } from "@/renderer/runtimes/browser-runtime.ts";

export const DUNGEON_RUN_HISTORY_QUERY_KEY_PREFIX = ["dungeon-run", "history"];

const NO_DUNGEON_RUN_HISTORY: DungeonRunApiHistory = {
  comparisonRunCount: 0,
  comparisonSampleCount: 0,
  observations: [],
  ownRunCount: 0,
  ownSampleCount: 0,
};

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
        }).pipe(
          E.catch((error) => {
            return E.logError(
              "Failed to load dungeon run history; treating as no history.",
              {
                dungeonId,
                dungeonLevel,
                error,
              },
            ).pipe(E.as(NO_DUNGEON_RUN_HISTORY));
          }),
        ),
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

export function useDungeonRunHistorySuspense(
  args: DungeonRunHistoryQueryOptionsArgs,
): DungeonRunApiHistory {
  const { data } = useSuspenseQuery(getDungeonRunHistoryQueryOptions(args));

  return data;
}

export function useInvalidateDungeonRunHistory(): () => void {
  const queryClient = useQueryClient();

  return useCallback(() => {
    void queryClient.invalidateQueries({
      queryKey: DUNGEON_RUN_HISTORY_QUERY_KEY_PREFIX,
    });
  }, [queryClient]);
}

export function useDungeonRunHistoryQuery(
  args: DungeonRunHistoryQueryOptionsArgs | null,
) {
  return useQuery(
    args === null
      ? {
          queryFn: skipToken,
          queryKey: [...DUNGEON_RUN_HISTORY_QUERY_KEY_PREFIX, "disabled"],
        }
      : getDungeonRunHistoryQueryOptions(args),
  );
}
