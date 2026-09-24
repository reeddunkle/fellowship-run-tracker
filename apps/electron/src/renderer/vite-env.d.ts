/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly PUBLIC_API_HOST: string;
  readonly PUBLIC_API_PORT: string;
  readonly PUBLIC_SIMULATE_FELLOWSHIP_LOGS_IMPORTS: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
