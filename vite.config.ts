import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

/** Dev proxy avoids browser CORS when the API runs on another port. */
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      "/api": { target: "https://proscout-api-beta-249863248759.us-central1.run.app", changeOrigin: true },
      "/auth": { target: "https://proscout-api-beta-249863248759.us-central1.run.app", changeOrigin: true },
    },
  },
});
