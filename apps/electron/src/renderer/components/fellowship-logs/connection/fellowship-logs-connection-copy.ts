import { type FellowshipLogsConnectionProfile } from "@frt/shared/fellowship-logs/fellowship-logs-connection-schema.ts";

export const FELLOWSHIP_LOGS_ACCOUNT_SETTINGS_URL =
  "https://www.fellowshiplogs.com/profile";

export const FELLOWSHIP_LOGS_CLIENTS_URL =
  "https://www.fellowshiplogs.com/api/clients/";

type FellowshipLogsProfileCopy = {
  readonly facts: ReadonlyArray<string>;
  readonly pointUsage: string;
  readonly spending: string;
  readonly summary: string;
  readonly title: string;
};

export const FELLOWSHIP_LOGS_PROFILE_COPY = {
  FELLOWSHIP_RUN_TRACKER_USER: {
    facts: [
      "You sign in to Fellowship Logs in your browser. Fellowship Run Tracker never sees your password.",
      "You can import public reports and private reports your account can see.",
      "When your account points run out, imports wait until they reset.",
      "The app stores this connection encrypted on your computer.",
    ],
    pointUsage: "Imports use your account points.",
    spending: "Uses your account points",
    summary:
      "Sign in with Fellowship Logs. Imports public reports and private reports your account can view.",
    title: "Connect with Fellowship Logs",
  },
  OWN_CLIENT: {
    facts: [
      "There's no browser sign-in.",
      "This option can import only public reports, even if the report was uploaded by the account that owns the API client.",
      "When your API client points run out, imports wait until they reset.",
      "The app stores this connection encrypted on your computer.",
    ],
    pointUsage: "Imports use your API client points.",
    spending: "Uses API client points",
    summary: "Enter API client credentials. Imports public reports only.",
    title: "Use my API client credentials",
  },
  OWN_CLIENT_USER: {
    facts: [
      "You sign in to Fellowship Logs in your browser. Fellowship Run Tracker never sees your password.",
      "You can import public reports and private reports your account can see.",
      "When both your account and API client points run out, imports wait until they reset.",
      "The app stores this connection encrypted on your computer.",
    ],
    pointUsage:
      "Imports use your account points first, then your API client points.",
    spending: "Uses your account points, then API client points",
    summary:
      "Sign in through your API client. Imports public reports and private reports your account can view.",
    title: "Sign in with my API client",
  },
} as const satisfies Record<
  FellowshipLogsConnectionProfile,
  FellowshipLogsProfileCopy
>;

export const POINT_SYSTEM_OPT_IN_STEPS = [
  "Open your Fellowship Logs account settings.",
  "Under Web API, opt into the new point system.",
  "Come back here and select Check again.",
] as const;
