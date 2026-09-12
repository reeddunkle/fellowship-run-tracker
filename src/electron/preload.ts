import { contextBridge, ipcRenderer, webUtils } from "electron";

import { ELECTRON_IPC_CHANNEL } from "@/electron/ipc/electron-ipc-channel.ts";

contextBridge.exposeInMainWorld("electronAPI", {
  appState: {
    get: () => {
      return ipcRenderer.invoke(ELECTRON_IPC_CHANNEL.APP_STATE_GET);
    },
    set: (appState: unknown) => {
      return ipcRenderer.invoke(ELECTRON_IPC_CHANNEL.APP_STATE_SET, appState);
    },
  },
  files: {
    getDirectoryPath: (file: File) => {
      const filePath = webUtils.getPathForFile(file);

      return ipcRenderer.invoke(ELECTRON_IPC_CHANNEL.FILE_GET_DIRECTORY_PATH, {
        filePath,
        relativePath: file.webkitRelativePath,
      });
    },
  },
  resizeWindowToContent: ({
    height,
    width,
  }: {
    readonly height: number;
    readonly width: number;
  }) => {
    return ipcRenderer.invoke(ELECTRON_IPC_CHANNEL.RESIZE_WINDOW_TO_CONTENT, {
      height,
      width,
    });
  },
  showWindow: () => {
    ipcRenderer.send(ELECTRON_IPC_CHANNEL.SHOW_WINDOW);
  },
});
