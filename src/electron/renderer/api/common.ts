export const API_CONNECTION_STATE = {
  CONNECTED: "CONNECTED",
  CONNECTING: "CONNECTING",
  DISCONNECTED: "DISCONNECTED",
} as const;

export type ApiConnectionState =
  (typeof API_CONNECTION_STATE)[keyof typeof API_CONNECTION_STATE];
