export const ELECTRON_IPC_CHANNEL = {
  APP_STATE_GET: "app-state:get",
  APP_STATE_SET: "app-state:set",
  FILE_GET_DIRECTORY_PATH: "file:get-directory-path",
  RESIZE_WINDOW_TO_CONTENT: "window:resize-to-content",
  SHOW_WINDOW: "window:show",
} as const;
