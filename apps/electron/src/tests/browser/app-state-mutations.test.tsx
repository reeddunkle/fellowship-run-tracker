import { QueryClient } from "@tanstack/react-query";
import { describe, expect, test, vi } from "vitest";

import {
  setSidebarOpenMutationOptions,
  setThemeMutationOptions,
} from "@/renderer/api/app-state/app-state-mutations.ts";

describe("app-state mutations", () => {
  test("serializes mutations to one field without blocking other fields", async () => {
    const queryClient = new QueryClient();
    const firstThemeMutation = setThemeMutationOptions(queryClient);
    const secondThemeMutation = setThemeMutationOptions(queryClient);
    const sidebarMutation = setSidebarOpenMutationOptions(queryClient);

    expect(firstThemeMutation.scope).toEqual(secondThemeMutation.scope);
    expect(firstThemeMutation.scope).not.toEqual(sidebarMutation.scope);

    const starts: Array<string> = [];
    let releaseFirst: (() => void) | undefined;
    let releaseSecond: (() => void) | undefined;
    // @effect-diagnostics-next-line newPromise:off
    const firstCompletion = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    // @effect-diagnostics-next-line newPromise:off
    const secondCompletion = new Promise<void>((resolve) => {
      releaseSecond = resolve;
    });
    const mutationCache = queryClient.getMutationCache();
    const first = mutationCache.build(queryClient, {
      ...firstThemeMutation,
      mutationFn: () => {
        starts.push("first");
        return firstCompletion;
      },
    });
    const second = mutationCache.build(queryClient, {
      ...secondThemeMutation,
      mutationFn: () => {
        starts.push("second");
        return secondCompletion;
      },
    });

    const firstResult = first.execute("light");
    const secondResult = second.execute("dark");
    await vi.waitFor(() => {
      expect(starts).toEqual(["first"]);
    });

    if (releaseFirst === undefined || releaseSecond === undefined) {
      throw new Error(
        "Expected mutation completion controls to be initialized",
      );
    }

    releaseFirst();
    await firstResult;
    await vi.waitFor(() => {
      expect(starts).toEqual(["first", "second"]);
    });
    releaseSecond();
    await secondResult;
  });
});
