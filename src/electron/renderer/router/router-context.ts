import { type browserRuntime } from "@/electron/renderer/runtimes/browser-runtime.ts";

export type RouterContext = {
  readonly browserRuntime: typeof browserRuntime;
};
