import { readdir, rm, stat } from "node:fs/promises";
import path from "node:path";

// [KEEP] This script deletes every node_modules directory, so don't load or run any deps here
const projectRoot = path.resolve(import.meta.dirname, "../../..");

const SKIP_DIRECTORY_NAMES = new Set([".git", ".pnpm-store", "node_modules"]);

async function findNodeModulesDirectories(
  directory: string,
): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });

  const directoryPaths = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => ({
      name: entry.name,
      path: path.join(directory, entry.name),
    }));

  const nodeModulesDirectories = directoryPaths
    .filter((entry) => entry.name === "node_modules")
    .map((entry) => entry.path);

  const nestedNodeModulesDirectories = await Promise.all(
    directoryPaths
      .filter((entry) => !SKIP_DIRECTORY_NAMES.has(entry.name))
      .map((entry) => findNodeModulesDirectories(entry.path)),
  );

  return [...nodeModulesDirectories, ...nestedNodeModulesDirectories.flat()];
}

async function pathExists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch {
    return false;
  }
}

// [KEEP] A recursive delete of a large node_modules tree occasionally trips over a
// file that a virus scanner or file indexer has momentarily locked, most
// often on Windows. `maxRetries`/`retryDelay` absorb that transient
// contention; if the directory is confirmed gone despite an error surviving
// the retries, treat it as success instead of failing the whole script.
async function removeDirectory(directoryPath: string): Promise<void> {
  try {
    await rm(directoryPath, {
      force: true,
      maxRetries: 5,
      recursive: true,
      retryDelay: 300,
    });
  } catch (error) {
    if (await pathExists(directoryPath)) {
      throw error;
    }
  }
}

const nodeModulesDirectories = await findNodeModulesDirectories(projectRoot);

for (const directory of nodeModulesDirectories) {
  await removeDirectory(directory);
}

await removeDirectory(path.resolve(projectRoot, ".pnpm-store"));
