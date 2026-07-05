/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_BACKEND_URL: string;
  /** Set in CI (GitHub Actions) to verify the deployed bundle. */
  readonly VITE_GITHUB_SHA: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
