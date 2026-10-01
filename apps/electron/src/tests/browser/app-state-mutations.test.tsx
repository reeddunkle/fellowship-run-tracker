import { QueryClient } from "@tanstack/react-query";
import { describe, expect, test, vi } from "vitest";

import {
  setSidebarOpenMutationOptions,
  setThemeMutationOptions,
} from "@/renderer/api/app-state/app-state-mutations.ts";

describe("app-state mutations", () => {
  test("serializes mutations to one field without blocking other fields", async () => {
    const queryClient = new QueryClient();
    const mutationCache = queryClient.getMutationCache();
    const starts: Array<string> = [];
    const firstThemeGate = Promise.withResolvers<void>();
    const secondThemeGate = Promise.withResolvers<void>();
    const sidebarGate = Promise.withResolvers<void>();

    const firstTheme = mutationCache.build(queryClient, {
      ...setThemeMutationOptions(queryClient),
      mutationFn: () => {
        starts.push("first-theme");
        return firstThemeGate.promise;
      },
    });
    const secondTheme = mutationCache.build(queryClient, {
      ...setThemeMutationOptions(queryClient),
      mutationFn: () => {
        starts.push("second-theme");
        return secondThemeGate.promise;
      },
    });
    const sidebar = mutationCache.build(queryClient, {
      ...setSidebarOpenMutationOptions(queryClient),
      mutationFn: () => {
        starts.push("sidebar");
        return sidebarGate.promise;
      },
    });

    const firstThemeResult = firstTheme.execute("light");
    const secondThemeResult = secondTheme.execute("dark");
    const sidebarResult = sidebar.execute(false);

    await vi.waitFor(() => {
      expect(starts.toSorted()).toEqual(["first-theme", "sidebar"]);
    });

    sidebarGate.resolve();
    await sidebarResult;

    expect(sidebar.state.status).toBe("success");
    expect(starts).not.toContain("second-theme");

    firstThemeGate.resolve();
    await firstThemeResult;
    await vi.waitFor(() => {
      expect(starts).toContain("second-theme");
    });

    secondThemeGate.resolve();
    await secondThemeResult;
  });
});
