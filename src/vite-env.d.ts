/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Version shown in the header badge; set in .env.local */
  readonly VITE_APP_VERSION?: string;
}
