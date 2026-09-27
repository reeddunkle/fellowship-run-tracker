import * as Data from "effect/Data";

export class ApiContractVersionError extends Data.TaggedError(
  "ApiContractVersionError",
)<{
  readonly apiContractVersion: number;
  readonly expectedApiContractVersion: number;
}> {
  override get message() {
    return `The API server speaks contract version ${this.apiContractVersion}, but this app expects version ${this.expectedApiContractVersion}. Another copy of Fellowship Run Tracker may be using the API port.`;
  }
}
