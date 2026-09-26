export const ELECTRON_IPC_CHANNEL = {
  APP_STATE_RPC: "app-state:rpc",
  FILE_GET_DIRECTORY_PATH: "file:get-directory-path",
  LOG_WRITE: "log:write",
  LOGS_OPEN_FOLDER: "logs:open-folder",
  RESIZE_WINDOW_TO_CONTENT: "window:resize-to-content",
  SHOW_WINDOW: "window:show",
} as const;
