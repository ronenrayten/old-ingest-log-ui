/** Base URL without trailing slash. Empty string uses same origin (Vite dev proxy). */
export const backendBaseUrl = (import.meta.env.VITE_BACKEND_URL ?? "").replace(/\/$/, "");
