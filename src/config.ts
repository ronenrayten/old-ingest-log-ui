/** Base URL without trailing slash. Empty string uses same origin (Vite dev proxy). */
export const backendBaseUrl = (import.meta.env.VITE_BACKEND_URL ?? "").replace(/\/$/, "");

/**
 * process-raw-device-data Cloud Run (rerun processing). Empty in dev → use `/process-raw` proxy (see vite.config.ts).
 */
export const processRawBaseUrl = (import.meta.env.VITE_PROCESS_RAW_URL ?? "").replace(/\/$/, "");
