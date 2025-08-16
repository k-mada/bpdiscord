/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_HOT_RELOAD: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}