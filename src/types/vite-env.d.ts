/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly PUBLIC_API_HOST: string;
  readonly PUBLIC_API_PORT: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
