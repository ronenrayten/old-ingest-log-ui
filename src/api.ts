import { backendBaseUrl } from "./config";
import { clearToken, getToken, setToken } from "./auth";

export type RerunStatus = "PENDING" | "EXECUTED";

export interface OldIngestLogRow {
  id: number;
  account_id: number;
  account_name: string;
  tool_id: number;
  tool_name: string;
  logged_at: string;
  received_at_date: string;
  data_timestamp_date: string;
  /** Rows in device_data_raw matching this log row (same filters as scan). */
  rawRowCount: number;
  rerun_status: RerunStatus;
}

function url(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return backendBaseUrl ? `${backendBaseUrl}${p}` : p;
}

export async function login(username: string, password: string): Promise<void> {
  const res = await fetch(url("/auth/login"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as { message?: string }).message ?? `Login failed (${res.status})`);
  }
  const data = (await res.json()) as { jwtToken?: string };
  if (!data.jwtToken) throw new Error("No token in login response");
  setToken(data.jwtToken);
}

export interface ListParams {
  accountId?: number;
  toolId?: number;
  rerunStatus?: RerunStatus;
  loggedFrom?: string;
  loggedTo?: string;
  receivedFrom?: string;
  receivedTo?: string;
}

export async function listOldIngestLogs(params: ListParams): Promise<OldIngestLogRow[]> {
  const token = getToken();
  if (!token) throw new Error("Not logged in");

  const q = new URLSearchParams();
  if (params.accountId != null) q.set("accountId", String(params.accountId));
  if (params.toolId != null) q.set("toolId", String(params.toolId));
  if (params.rerunStatus) q.set("rerunStatus", params.rerunStatus);
  if (params.loggedFrom) q.set("loggedFrom", params.loggedFrom);
  if (params.loggedTo) q.set("loggedTo", params.loggedTo);
  if (params.receivedFrom) q.set("receivedFrom", params.receivedFrom);
  if (params.receivedTo) q.set("receivedTo", params.receivedTo);

  const qs = q.toString();
  const path = `/api/device-data-raw/old-ingest-log${qs ? `?${qs}` : ""}`;

  const res = await fetch(url(path), {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });

  if (res.status === 401) {
    clearToken();
    throw new Error("Session expired. Please sign in again.");
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Request failed (${res.status})`);
  }
  return res.json() as Promise<OldIngestLogRow[]>;
}

export async function patchRerunStatus(id: number, rerunStatus: RerunStatus): Promise<OldIngestLogRow> {
  const token = getToken();
  if (!token) throw new Error("Not logged in");

  const res = await fetch(url(`/api/device-data-raw/old-ingest-log/${id}/rerun-status`), {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ rerunStatus }),
  });

  if (res.status === 401) {
    clearToken();
    throw new Error("Session expired. Please sign in again.");
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Update failed (${res.status})`);
  }
  return res.json() as Promise<OldIngestLogRow>;
}
