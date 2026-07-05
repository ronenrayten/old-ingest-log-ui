import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Base path for built assets. In CI, set GCS_BUCKET_BASE to the bucket name (no gs://). */
function assetBase(): string {
  const bucket = process.env.GCS_BUCKET_BASE?.trim().replace(/^\/+|\/+$/g, "");
  if (bucket) return `/${bucket}/`;
  // Local dev / unprefixed hosting: relative URLs next to index.html
  return "./";
}

/** Dev proxy avoids browser CORS when the API runs on another port. */
export default defineConfig({
  base: assetBase(),
  plugins: [react()],
  server: {
    proxy: {
      "/api": { target: "https://prod-proscout-api-1057209384551.us-central1.run.app", changeOrigin: true },
      "/auth": { target: "https://prod-proscout-api-1057209384551.us-central1.run.app", changeOrigin: true },
    },
  },
});
