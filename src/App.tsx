import { useCallback, useEffect, useState } from "react";
import {
  listOldIngestLogs,
  login,
  patchRerunStatus,
  type ListParams,
  type OldIngestLogRow,
  type RerunStatus,
} from "./api";
import { clearToken, isLoggedIn } from "./auth";
import "./index.css";

export default function App() {
  const [authed, setAuthed] = useState(isLoggedIn);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginBusy, setLoginBusy] = useState(false);

  const [rows, setRows] = useState<OldIngestLogRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  /** Omit both to use API default (today on the server). */
  const [loggedFrom, setLoggedFrom] = useState("");
  const [loggedTo, setLoggedTo] = useState("");
  const [receivedFrom, setReceivedFrom] = useState("");
  const [receivedTo, setReceivedTo] = useState("");
  const [accountId, setAccountId] = useState("");
  const [toolId, setToolId] = useState("");
  const [rerunStatus, setRerunStatusFilter] = useState<"" | RerunStatus>("");

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    const params: ListParams = {};
    if (loggedFrom) params.loggedFrom = loggedFrom;
    if (loggedTo) params.loggedTo = loggedTo;
    if (receivedFrom) params.receivedFrom = receivedFrom;
    if (receivedTo) params.receivedTo = receivedTo;
    if (accountId.trim()) {
      const n = Number(accountId);
      if (!Number.isNaN(n)) params.accountId = n;
    }
    if (toolId.trim()) {
      const n = Number(toolId);
      if (!Number.isNaN(n)) params.toolId = n;
    }
    if (rerunStatus) params.rerunStatus = rerunStatus;
    try {
      const data = await listOldIngestLogs(params);
      setRows(data);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [
    loggedFrom,
    loggedTo,
    receivedFrom,
    receivedTo,
    accountId,
    toolId,
    rerunStatus,
  ]);

  useEffect(() => {
    if (authed) void load();
  }, [authed, load]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoginError(null);
    setLoginBusy(true);
    try {
      await login(username, password);
      setAuthed(true);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoginBusy(false);
    }
  }

  function logout() {
    clearToken();
    setAuthed(false);
    setRows([]);
  }

  async function updateStatus(row: OldIngestLogRow, next: RerunStatus) {
    try {
      const updated = await patchRerunStatus(row.id, next);
      setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Update failed");
    }
  }

  if (!authed) {
    return (
      <div className="shell">
        <header className="header">
          <h1>Old ingest log</h1>
          <p className="muted">Sign in with your ProScout API credentials.</p>
        </header>
        <form className="card" onSubmit={handleLogin}>
          <label>
            Email / username
            <input
              type="text"
              autoComplete="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </label>
          <label>
            Password
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </label>
          {loginError && <p className="error">{loginError}</p>}
          <button type="submit" disabled={loginBusy}>
            {loginBusy ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="shell wide">
      <header className="header row">
        <div>
          <h1>Device data raw — old ingest log</h1>
          <p className="muted">
            Rows are filtered by <code>logged_at</code> date (inclusive). Empty logged range lets the
            API default to today on the server.
          </p>
        </div>
        <button type="button" className="btn-secondary" onClick={logout}>
          Sign out
        </button>
      </header>

      <section className="card filters">
        <div className="grid">
          <label>
            Logged from
            <input type="date" value={loggedFrom} onChange={(e) => setLoggedFrom(e.target.value)} />
          </label>
          <label>
            Logged to
            <input type="date" value={loggedTo} onChange={(e) => setLoggedTo(e.target.value)} />
          </label>
          <label>
            Received from
            <input
              type="date"
              value={receivedFrom}
              onChange={(e) => setReceivedFrom(e.target.value)}
            />
          </label>
          <label>
            Received to
            <input type="date" value={receivedTo} onChange={(e) => setReceivedTo(e.target.value)} />
          </label>
          <label>
            Account ID
            <input
              type="text"
              inputMode="numeric"
              placeholder="optional"
              value={accountId}
              onChange={(e) => setAccountId(e.target.value)}
            />
          </label>
          <label>
            Tool ID
            <input
              type="text"
              inputMode="numeric"
              placeholder="optional"
              value={toolId}
              onChange={(e) => setToolId(e.target.value)}
            />
          </label>
          <label>
            Rerun status
            <select
              value={rerunStatus}
              onChange={(e) => setRerunStatusFilter(e.target.value as "" | RerunStatus)}
            >
              <option value="">Any</option>
              <option value="PENDING">PENDING</option>
              <option value="EXECUTED">EXECUTED</option>
            </select>
          </label>
        </div>
        <div className="actions">
          <button type="button" onClick={() => void load()} disabled={loading}>
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>
      </section>

      {loadError && <p className="error banner">{loadError}</p>}

      <div className="table-wrap card">
        <table className="data">
          <thead>
            <tr>
              <th>ID</th>
              <th>Account</th>
              <th>Tool</th>
              <th>Logged at</th>
              <th>Received date</th>
              <th>Data timestamp date</th>
              <th>Raw rows</th>
              <th>Rerun</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={8} className="muted center">
                  No rows for this filter.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.id}</td>
                <td>
                  <span className="nowrap" title={r.account_name}>
                    {r.account_id}
                  </span>
                  <div className="sub">{r.account_name}</div>
                </td>
                <td>
                  <span className="nowrap">{r.tool_id}</span>
                  <div className="sub">{r.tool_name || "—"}</div>
                </td>
                <td className="nowrap">{formatDt(r.logged_at)}</td>
                <td>{r.received_at_date}</td>
                <td>{r.data_timestamp_date}</td>
                <td className="nowrap">{r.rawRowCount ?? "—"}</td>
                <td>
                  <span className={`pill ${r.rerun_status === "PENDING" ? "pending" : "done"}`}>
                    {r.rerun_status}
                  </span>
                  <div className="row-actions">
                    {r.rerun_status === "PENDING" ? (
                      <button type="button" className="link" onClick={() => void updateStatus(r, "EXECUTED")}>
                        Mark executed
                      </button>
                    ) : (
                      <button type="button" className="link" onClick={() => void updateStatus(r, "PENDING")}>
                        Mark pending
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatDt(iso: string): string {
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleString();
  } catch {
    return iso;
  }
}
