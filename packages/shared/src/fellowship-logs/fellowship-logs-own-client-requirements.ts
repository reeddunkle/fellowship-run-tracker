export const FELLOWSHIP_LOGS_OWN_CLIENT_REDIRECT_URI =
  "http://127.0.0.1:47892/oauth/callback";

export const FELLOWSHIP_LOGS_OWN_CLIENT_REQUIREMENTS = [
  "Enable Public Client when you create the API client.",
  `Enter ${FELLOWSHIP_LOGS_OWN_CLIENT_REDIRECT_URI} as the callback URL.`,
] as const;
