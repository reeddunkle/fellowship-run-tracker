/**
 * Mirrors Electron's `app.isPackaged`, which isn't available here: the api
 * package also runs outside Electron (CLIs, tests), and callers need this when
 * modules load. Electron sets `process.defaultApp` when the stock Electron
 * binary runs an app passed to it, rather than a packaged app's own executable.
 */
export function isPackagedElectronApp() {
  return (
    process.versions.electron !== undefined &&
    Reflect.get(process, "defaultApp") !== true
  );
}
