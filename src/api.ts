import { backendBaseUrl, processRawBaseUrl } from "./config";
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
  raw_row_count?: number;
  rerun_status: RerunStatus;
}

/** Normalize one JSON row (API may use snake_case or camelCase). */
export function normalizeIngestLogRow(data: unknown): OldIngestLogRow {
  if (!data || typeof data !== "object") {
    throw new Error("Invalid row");
  }
  const row = data as Record<string, unknown>;
  const v = row.raw_row_count ?? row.rawRowCount;
  let raw_row_count: number | undefined;
  if (typeof v === "number" && Number.isFinite(v)) {
    raw_row_count = v;
  } else if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) raw_row_count = n;
  }
  const base = data as OldIngestLogRow;
  return {
    ...base,
    raw_row_count: raw_row_count ?? base.raw_row_count,
  };
}

/** Display helper: reads loose JSON keys (snake_case / camelCase). */
export function formatRawRowCount(row: OldIngestLogRow): string {
  const loose = row as unknown as Record<string, unknown>;
  const v = loose.raw_row_count ?? loose.rawRowCount;
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    if (Number.isFinite(n)) return String(n);
  }
  return "—";
}

function url(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return backendBaseUrl ? `${backendBaseUrl}${p}` : p;
}

/** process-raw-device-data service; dev uses `/process-raw` proxy when env is unset. */
function processRawUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  const base =
    processRawBaseUrl || (import.meta.env.DEV ? "/process-raw" : "");
  if (!base) {
    throw new Error(
      "VITE_PROCESS_RAW_URL is not set (required for production builds).",
    );
  }
  return `${base}${p}`;
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
  const data: unknown = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map((item) => normalizeIngestLogRow(item));
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
  return normalizeIngestLogRow(await res.json());
}

/** Activities API (Spring). */
export interface ActivityListItem {
  /** Stringified so large int64 ids are not rounded by JS. */
  id: string;
}

export async function getActivitiesForAccountDate(
  accountId: number,
  date: string,
): Promise<ActivityListItem[]> {
  const token = getToken();
  if (!token) throw new Error("Not logged in");

  const res = await fetch(
    url(`/activities/account/${accountId}/date/${encodeURIComponent(date)}`),
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    },
  );

  if (res.status === 401) {
    clearToken();
    throw new Error("Session expired. Please sign in again.");
  }
  if (res.status === 404) {
    return [];
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Activities request failed (${res.status})`);
  }
  const data: unknown = await res.json();
  if (!Array.isArray(data)) return [];
  return data.map((item) => {
    const o = item as Record<string, unknown>;
    if (o.id == null) throw new Error("Activity missing id");
    return { id: String(o.id) };
  });
}

export async function deleteActivityExecution(
  activityId: string,
  accountId: number,
): Promise<void> {
  const token = getToken();
  if (!token) throw new Error("Not logged in");

  const res = await fetch(
    url(
      `/activities/${encodeURIComponent(activityId)}/account/${encodeURIComponent(String(accountId))}/execution`,
    ),
    {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    },
  );

  if (res.status === 401) {
    clearToken();
    throw new Error("Session expired. Please sign in again.");
  }
  if (!res.ok && res.status !== 204) {
    const text = await res.text();
    throw new Error(text || `Delete activity execution failed (${res.status})`);
  }
}

/**
 * Triggers full-day processing for one account (process-raw-device-data Cloud Run).
 * Body matches the Python service: `{ account_id, spraying_date }`.
 */
export async function postProcessingRerun(
  accountId: number,
  sprayingDate: string,
): Promise<void> {
  const token = getToken();
  if (!token) throw new Error("Not logged in");

  let res: Response;
  try {
    res = await fetch(
      processRawUrl("/processing-routes-by-account-date"),
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({
          account_id: accountId,
          spraying_date: sprayingDate,
        }),
      },
    );
  } catch {
    throw new Error(
      "Rerun request was blocked before reaching the server. " +
        "This is usually a CORS/preflight issue on process-raw-device-data. " +
        "Verify VITE_PROCESS_RAW_URL points to the correct environment and that the service allows Origin https://storage.googleapis.com " +
        "with methods POST, OPTIONS and headers Authorization, Content-Type.",
    );
  }

  if (res.status === 401) {
    clearToken();
    throw new Error("Session expired. Please sign in again.");
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || `Processing rerun failed (${res.status})`);
  }
}

/**
 * All ingest log rows for this account with the same data_timestamp_date (spraying day).
 * Uses list + client filter; may be heavy for very large accounts.
 */
export async function listIngestRowsForAccountAndDataDay(
  accountId: number,
  dataDay: string,
): Promise<OldIngestLogRow[]> {
  // Do not rely on API defaults (often "today"), otherwise rows from older days are missed.
  const all = await listOldIngestLogs({
    accountId,
    loggedFrom: "2000-01-01",
    loggedTo: "2100-01-01",
  });
  return all.filter((r) => r.data_timestamp_date === dataDay);
}

/**
 * Rerun flow for one selected row’s spraying day (full account + day):
 * 1) Delete all activities for that account+date
 * 2) POST process-raw rerun for that account+date
 * 3) Mark all related old-ingest-log rows (same account + data_timestamp_date) as EXECUTED
 */
export async function runRerunActivityDayForRow(
  row: OldIngestLogRow,
): Promise<void> {
  const accountId = row.account_id;
  const sprayingDate = row.data_timestamp_date;

  const activities = await getActivitiesForAccountDate(accountId, sprayingDate);
  for (const a of activities) {
    await deleteActivityExecution(a.id, accountId);
  }

  await postProcessingRerun(accountId, sprayingDate);

  const related = await listIngestRowsForAccountAndDataDay(
    accountId,
    sprayingDate,
  );
  // Always include the selected row itself, then any additional related rows.
  const ids = new Set<number>([row.id, ...related.map((r) => r.id)]);
  const patchAll = async (): Promise<PromiseSettledResult<OldIngestLogRow>[]> =>
    Promise.allSettled([...ids].map((id) => patchRerunStatus(id, "EXECUTED")));

  let results = await patchAll();
  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0) {
    // One retry for transient failures.
    results = await patchAll();
    const failedRetry = results.filter((r) => r.status === "rejected").length;
    if (failedRetry > 0) {
      throw new Error(
        `Rerun completed, but failed to set EXECUTED on ${failedRetry} row(s).`,
      );
    }
  }

  // Verify persisted state from API to catch cases where patch was accepted but not saved.
  const verify = await listIngestRowsForAccountAndDataDay(accountId, sprayingDate);
  const stillPending = verify.filter(
    (r) => ids.has(r.id) && r.rerun_status !== "EXECUTED",
  );
  if (stillPending.length > 0) {
    throw new Error(
      `Rerun completed, but ${stillPending.length} row(s) are still not EXECUTED after refresh.`,
    );
  }
}
