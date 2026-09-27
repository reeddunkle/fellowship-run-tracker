import * as Data from "effect/Data";

export class DatabaseNewerThanAppError extends Data.TaggedError(
  "DatabaseNewerThanAppError",
)<{
  readonly database: "Analytics" | "Main" | "State";
  readonly databaseVersion: number;
  readonly supportedDatabaseVersion: number;
}> {
  override get message() {
    return `The ${this.database.toLowerCase()} database is at version ${this.databaseVersion}, but this version of Fellowship Run Tracker only supports up to version ${this.supportedDatabaseVersion}. It was likely created by a newer version of the app. Update Fellowship Run Tracker and try again.`;
  }
}
