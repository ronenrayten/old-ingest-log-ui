import { backendBaseUrl } from "./config";
import { clearToken, getToken, setToken } from "./auth";

export interface OldIngestRow {
  account_id: number;
  account_name: string;
  tool_id: number;
  tool_name: string;
  received_at_date: string;
  data_timestamp_date: string;
  raw_row_count: number;
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

export interface QueryParams {
  receivedDate?: string;
  receivedFrom?: string;
  receivedTo?: string;
  accountId?: number;
  toolId?: number;
  dataFrom?: string;
  dataTo?: string;
}

function normalizeRow(data: unknown): OldIngestRow {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid row");
  }
  const row = data as Record<string, unknown>;
  const rawCount = row.raw_row_count ?? row.rawRowCount;
  const n =
    typeof rawCount === "number"
      ? rawCount
      : typeof rawCount === "string"
        ? Number(rawCount)
        : NaN;
  return {
    account_id: Number(row.account_id ?? row.accountId),
    account_name: String(row.account_name ?? row.accountName ?? ""),
    tool_id: Number(row.tool_id ?? row.toolId),
    tool_name: String(row.tool_name ?? row.toolName ?? ""),
    received_at_date: String(row.received_at_date ?? row.receivedAtDate ?? ""),
    data_timestamp_date: String(row.data_timestamp_date ?? row.dataTimestampDate ?? ""),
    raw_row_count: Number.isFinite(n) ? n : 0,
  };
}

/** Live BigQuery old-ingest query via Spring Boot. */
export async function queryOldIngest(params: QueryParams): Promise<OldIngestRow[]> {
  const token = getToken();
  if (!token) throw new Error("Not logged in");

  const q = new URLSearchParams();
  if (params.receivedDate) q.set("receivedDate", params.receivedDate);
  if (params.receivedFrom) q.set("receivedFrom", params.receivedFrom);
  if (params.receivedTo) q.set("receivedTo", params.receivedTo);
  if (params.accountId != null) q.set("accountId", String(params.accountId));
  if (params.toolId != null) q.set("toolId", String(params.toolId));
  if (params.dataFrom) q.set("dataFrom", params.dataFrom);
  if (params.dataTo) q.set("dataTo", params.dataTo);

  const qs = q.toString();
  if (!qs) {
    throw new Error("Received date is required");
  }

  const path = `/api/telemetry/old-ingest?${qs}`;
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
  const data: unknown = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map((item) => normalizeRow(item));
}

export function rowKey(row: OldIngestRow): string {
  return `${row.tool_id}-${row.received_at_date}-${row.data_timestamp_date}`;
}
