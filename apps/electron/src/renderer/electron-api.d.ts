import { type RendererLogEntry } from "@frt/shared/electron-renderer/renderer-log-entry-schema.ts";
import { type AppStateRpcRequest } from "@frt/shared/app-state/app-state-rpc.ts";

declare global {
  interface Window {
    readonly electronAPI: {
      readonly appState: {
        readonly request: (request: AppStateRpcRequest) => Promise<unknown>;
      };
      readonly files: {
        readonly getDirectoryPath: (file: File) => Promise<string>;
      };
      readonly log: (entry: RendererLogEntry) => void;
      readonly logs: {
        readonly openFolder: () => Promise<void>;
      };
      readonly resizeWindowToContent: (options: {
        readonly height: number;
        readonly width: number;
      }) => Promise<void>;
      readonly showWindow: () => void;
    };
  }
}
