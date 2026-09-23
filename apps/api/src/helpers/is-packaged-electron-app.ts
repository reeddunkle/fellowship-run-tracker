export function isPackagedElectronApp() {
  return (
    process.versions.electron !== undefined &&
    Reflect.get(process, "defaultApp") !== true
  );
}
