// @effect-diagnostics-next-line nodeBuiltinImport:off
import { copyFile, mkdir } from "node:fs/promises";
// @effect-diagnostics-next-line nodeBuiltinImport:off
import path from "node:path";

import { FuseV1Options, FuseVersion } from "@electron/fuses";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { nodeFileTrace } from "@vercel/nft";

const projectRoot = path.resolve(import.meta.dirname);
const workspaceRoot = path.resolve(projectRoot, "../..");

/**
 * With pnpm's hoisted node-linker (required by Electron Forge), every
 * workspace package's dependencies land in the workspace root's shared
 * node_modules — outside the `apps/electron` directory Forge copies, and
 * alongside devDependencies-only tooling (playwright, puppeteer, knip, etc.)
 * that the packaged app never requires at runtime. Trace the actual built
 * entry points to find only the node_modules files they really load, so they
 * can be copied into the package explicitly.
 *
 * `electron` isn't traced because the packaged app resolves it as a built-in
 * module; tracing it would pull in its installer's dependencies.
 */
async function traceNodeModulesFiles() {
  const { fileList } = await nodeFileTrace(
    [
      path.join(projectRoot, "dist/bootstrap.js"),
      path.join(projectRoot, "dist/main.js"),
      path.join(projectRoot, "dist/preload.cjs"),
    ],
    {
      base: workspaceRoot,
      ignore: (file) =>
        file.replaceAll("\\", "/").startsWith("node_modules/electron/"),
    },
  );

  return [...fileList]
    .map((file) => file.replaceAll("\\", "/"))
    .filter((file) => file.startsWith("node_modules/"));
}

async function copyNodeModulesFiles(files, buildPath) {
  const directories = [
    ...new Set(files.map((file) => path.dirname(path.join(buildPath, file)))),
  ];

  await Promise.all(
    directories.map((directory) => mkdir(directory, { recursive: true })),
  );

  await Promise.all(
    files.map((file) =>
      copyFile(path.join(workspaceRoot, file), path.join(buildPath, file)),
    ),
  );
}

export default async () => {
  const nodeModulesFiles = await traceNodeModulesFiles();

  return {
    hooks: {
      // Runs before Forge's native module rebuild step.
      packageAfterCopy: async (_forgeConfig, buildPath) => {
        await copyNodeModulesFiles(nodeModulesFiles, buildPath);
      },
    },
    makers: [
      {
        name: "@electron-forge/maker-zip",
        platforms: ["darwin", "linux", "win32"],
      },
    ],
    packagerConfig: {
      asar: true,
      executableName: "fellowship-run-tracker",
      ignore: (file) =>
        !(file === "" || file === "/package.json" || file.startsWith("/dist")),
      // node_modules is assembled from the trace above rather than copied and
      // pruned by the packager, which would drop runtime packages declared as
      // devDependencies (e.g. `@effect/platform-node`, bundled into dist).
      prune: false,
    },
    plugins: [
      new AutoUnpackNativesPlugin({}),
      // Flipped in the packaged Electron binary. Closes off ways to run
      // arbitrary code through the app's executable, and makes it refuse to
      // load a modified or unpacked `app.asar`.
      new FusesPlugin({
        version: FuseVersion.V1,
        [FuseV1Options.EnableCookieEncryption]: true,
        [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
        [FuseV1Options.EnableNodeCliInspectArguments]: false,
        [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
        // The renderer is loaded from `file://`, which needs these privileges
        // (e.g. for ES module scripts). Can be disabled if the renderer moves
        // to a custom protocol.
        [FuseV1Options.GrantFileProtocolExtraPrivileges]: true,
        [FuseV1Options.OnlyLoadAppFromAsar]: true,
        [FuseV1Options.RunAsNode]: false,
      }),
    ],
    rebuildConfig: {},
  };
};
