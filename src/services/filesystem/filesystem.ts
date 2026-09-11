import * as FileSystem from "effect/FileSystem";
import * as Option from "effect/Option";

import { getDateEpochMilliseconds } from "@/util/get-date-epoch-milliseconds.ts";

export type FileData = {
  readonly createdAtEpochMilliseconds: number;
  readonly fileId: string;
  readonly filePath: string;
  readonly modifiedAtEpochMilliseconds: number;
  readonly size: FileSystem.Size;
};

export type FileReadState = {
  readonly byteOffset: FileSystem.Size;
  readonly decoder: TextDecoder;
  readonly file: FileData;
  readonly incompleteLine: string;
};

export type ReadAppendedLinesOptions = {
  readonly file: FileData;
  readonly state: FileReadState;
};

export type ReadAppendedLinesResult = {
  readonly lines: ReadonlyArray<string>;
  readonly state: FileReadState;
};

export function getFileId({
  filePath,
  info,
}: {
  readonly filePath: string;
  readonly info: FileSystem.File.Info;
}): string {
  const inode = Option.getOrUndefined(info.ino);
  const createdAtEpochMilliseconds = getDateEpochMilliseconds(info.birthtime);

  return [filePath, inode ?? "unknown-inode", createdAtEpochMilliseconds].join(
    ":",
  );
}

export function splitCompleteLines({
  incompleteLine,
  text,
}: {
  readonly incompleteLine: string;
  readonly text: string;
}): {
  readonly incompleteLine: string;
  readonly lines: ReadonlyArray<string>;
} {
  const bufferedText = incompleteLine + text;
  const lines = bufferedText.split(/\r?\n/);
  const nextIncompleteLine = lines.pop() ?? "";

  return {
    incompleteLine: nextIncompleteLine,
    lines: lines.filter((line) => line.length > 0),
  };
}

export function createFileReadState({
  byteOffset,
  file,
}: {
  readonly byteOffset: FileSystem.Size;
  readonly file: FileData;
}): FileReadState {
  return {
    byteOffset,
    decoder: new TextDecoder(),
    file,
    incompleteLine: "",
  };
}

export function createFileReadStateFromBeginning(file: FileData) {
  return createFileReadState({
    byteOffset: FileSystem.Size(0),
    file,
  });
}

export function isSameFile(left: FileData, right: FileData): boolean {
  return left.fileId === right.fileId;
}

export function compareFiles(left: FileData, right: FileData): number {
  const createdAtDifference =
    right.createdAtEpochMilliseconds - left.createdAtEpochMilliseconds;

  if (createdAtDifference !== 0) {
    return createdAtDifference;
  }

  const modifiedAtDifference =
    right.modifiedAtEpochMilliseconds - left.modifiedAtEpochMilliseconds;

  if (modifiedAtDifference !== 0) {
    return modifiedAtDifference;
  }

  return right.filePath.localeCompare(left.filePath);
}
