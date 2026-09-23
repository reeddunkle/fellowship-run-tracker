export const APP_CONFIG_DEFAULTS = {
  ELECTRON_RENDERER_HOST: "127.0.0.1",
  ELECTRON_RENDERER_PORT: 5173,
  FELLOWSHIP_LOG_DIRECTORY: String.raw`C:\Program Files (x86)\Steam\steamapps\common\Fellowship\fellowship\Saved\CombatLogs`,
  LIVE_SPLIT_HOST: "localhost",
  LIVE_SPLIT_PORT: 16834,
  PUBLIC_API_HOST: "127.0.0.1",
  PUBLIC_API_PORT: 47891,
} as const;
