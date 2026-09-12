import { type AppState } from "@/electron/storage/app-state/app-state-schema.ts";

declare global {
  interface Window {
    readonly electronAPI: {
      readonly appState: {
        readonly get: () => Promise<AppState>;
        readonly set: (appState: AppState) => Promise<void>;
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
