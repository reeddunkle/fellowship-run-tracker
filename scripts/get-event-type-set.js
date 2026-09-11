import { readFile } from "node:fs/promises";

const logFilePath = process.argv[2];

if (logFilePath === undefined) {
  throw new Error("Usage: node list-event-types.js <log-file-path>");
}

const logContents = await readFile(logFilePath, "utf8");

const eventTypes = new Set(
  logContents
    .split(/\r?\n/)
    .filter((line) => {
      return line.length > 0;
    })
    .map((line) => {
      return line.split("|", 2)[1];
    })
    .filter((eventType) => {
      return eventType !== undefined;
    }),
);

console.log([...eventTypes].sort().join("\n"));
