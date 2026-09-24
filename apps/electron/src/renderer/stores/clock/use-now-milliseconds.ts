import { useSyncExternalStore } from "react";

import { clockStore } from "@/renderer/stores/clock/clock-store.ts";

export function useNowMilliseconds(): number {
  return useSyncExternalStore(clockStore.subscribe, clockStore.getSnapshot);
}
