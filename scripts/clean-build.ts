import { rm } from "node:fs/promises";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const distDirectory = path.resolve(projectRoot, "dist");

await rm(distDirectory, {
  force: true,
  recursive: true,
});
