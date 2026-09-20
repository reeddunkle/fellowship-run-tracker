import { type AppStateRpcRequest } from "@/services/api/app-state/app-state-rpc.ts";

declare global {
  interface Window {
    readonly electronAPI: {
      readonly appState: {
        readonly request: (request: AppStateRpcRequest) => Promise<unknown>;
      };
      readonly files: {
        readonly getDirectoryPath: (file: File) => Promise<string>;
      };
      readonly resizeWindowToContent: (options: {
        readonly height: number;
        readonly width: number;
      }) => Promise<void>;
      readonly showWindow: () => void;
    };
  }
}
