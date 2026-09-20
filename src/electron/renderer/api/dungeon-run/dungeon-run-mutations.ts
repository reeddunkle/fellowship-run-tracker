import {
  mutationOptions,
  type QueryClient,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query";
import { useCallback } from "react";

import { deleteDungeonRunHistory } from "@/electron/renderer/api/dungeon-run/dungeon-run-client.ts";
import { getDungeonRunHistoryQueryOptions } from "@/electron/renderer/api/dungeon-run/dungeon-run-queries.ts";
import { browserRuntime } from "@/electron/renderer/runtimes/browser-runtime.ts";
import { type DungeonId } from "@/services/fellowship/validation/fellowship-common.ts";

export type DeleteDungeonRunHistoryArgs = {
  readonly dungeonId: DungeonId;
  readonly dungeonLevel: number;
};

export function deleteDungeonRunHistoryMutationOptions(
  queryClient: QueryClient,
) {
  return mutationOptions({
    mutationFn: (args: DeleteDungeonRunHistoryArgs) => {
      return browserRuntime.runPromise(deleteDungeonRunHistory(args));
    },
    mutationKey: ["dungeon-run", "history", "delete"],
    onSuccess: (_data, { dungeonId, dungeonLevel }) => {
      return queryClient.invalidateQueries({
        queryKey: getDungeonRunHistoryQueryOptions({
          dungeonId,
          dungeonLevel,
        }).queryKey,
      });
    },
  });
}

export function useDeleteDungeonRunHistory({
  dungeonId,
  dungeonLevel,
}: DeleteDungeonRunHistoryArgs) {
  const queryClient = useQueryClient();
  const { mutate, isPending } = useMutation(
    deleteDungeonRunHistoryMutationOptions(queryClient),
  );
  const deleteHistory = useCallback(() => {
    mutate({ dungeonId, dungeonLevel });
  }, [mutate, dungeonId, dungeonLevel]);

  return { delete: deleteHistory, isPending };
}
