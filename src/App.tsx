import { useCallback, useEffect, useState } from "react";
import {
  queryOldIngest,
  login,
  rowKey,
  type OldIngestRow,
  type QueryParams,
} from "./api";
import pkg from "../package.json";
import { clearToken, isLoggedIn } from "./auth";
import "./index.css";

function utcYesterday(): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export default function App() {
  const [authed, setAuthed] = useState(isLoggedIn);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loginBusy, setLoginBusy] = useState(false);

  const [rows, setRows] = useState<OldIngestRow[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [receivedFrom, setReceivedFrom] = useState(utcYesterday);
  const [receivedTo, setReceivedTo] = useState(utcYesterday);
  const [dataFrom, setDataFrom] = useState("");
  const [dataTo, setDataTo] = useState("");
  const [accountId, setAccountId] = useState("");
  const [toolId, setToolId] = useState("");

  const load = useCallback(async () => {
    if (!receivedFrom && !receivedTo) {
      setLoadError("Received date is required");
      return;
    }
    setLoading(true);
    setLoadError(null);
    const params: QueryParams = {};
    if (receivedFrom) params.receivedFrom = receivedFrom;
    if (receivedTo) params.receivedTo = receivedTo;
    if (dataFrom) params.dataFrom = dataFrom;
    if (dataTo) params.dataTo = dataTo;
    if (accountId.trim()) {
      const n = Number(accountId);
      if (!Number.isNaN(n)) params.accountId = n;
    }
    if (toolId.trim()) {
      const n = Number(toolId);
      if (!Number.isNaN(n)) params.toolId = n;
    }
    try {
      const data = await queryOldIngest(params);
      setRows(data);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Failed to load");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [receivedFrom, receivedTo, dataFrom, dataTo, accountId, toolId]);

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

  const totalRows = rows.reduce((sum, r) => sum + r.raw_row_count, 0);

  return (
    <div className="shell wide">
      <header className="header row">
        <div>
          <h1>Telemetry old ingest</h1>
          <p className="muted">
            Live query on BigQuery <code>telemetry_entries</code>. Rows ingested on the received
            date(s) (UTC) whose sample <code>timestamp</code> is on an earlier day, with positive
            flow meter.
          </p>
        </div>
        <button type="button" className="btn-secondary" onClick={logout}>
          Sign out
        </button>
      </header>

      <section className="card filters">
        <div className="grid">
          <label>
            Received from (UTC)
            <input
              type="date"
              value={receivedFrom}
              onChange={(e) => setReceivedFrom(e.target.value)}
              required
            />
          </label>
          <label>
            Received to (UTC)
            <input
              type="date"
              value={receivedTo}
              onChange={(e) => setReceivedTo(e.target.value)}
              required
            />
          </label>
          <label>
            Data from (UTC)
            <input type="date" value={dataFrom} onChange={(e) => setDataFrom(e.target.value)} />
          </label>
          <label>
            Data to (UTC)
            <input type="date" value={dataTo} onChange={(e) => setDataTo(e.target.value)} />
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
        </div>
        <div className="actions">
          <button type="button" onClick={() => void load()} disabled={loading}>
            {loading ? "Querying…" : "Query"}
          </button>
        </div>
      </section>

      {loadError && <p className="error banner">{loadError}</p>}

      {rows.length > 0 && (
        <p className="muted summary">
          {rows.length} group{rows.length === 1 ? "" : "s"} · {totalRows.toLocaleString()} telemetry
          rows
        </p>
      )}

      <div className="table-wrap card">
        <table className="data">
          <thead>
            <tr>
              <th className="col-raw">Raw rows</th>
              <th>Account</th>
              <th>Tool</th>
              <th>Received date</th>
              <th>Data timestamp date</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && !loading && (
              <tr>
                <td colSpan={5} className="muted center">
                  No rows for this filter.
                </td>
              </tr>
            )}
            {rows.map((r) => (
              <tr key={rowKey(r)}>
                <td className="nowrap col-raw">{r.raw_row_count.toLocaleString()}</td>
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
                <td>{r.received_at_date}</td>
                <td>{r.data_timestamp_date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="muted footer-meta">
        UI v{pkg.version}
        {import.meta.env.VITE_GITHUB_SHA
          ? ` · ${import.meta.env.VITE_GITHUB_SHA.slice(0, 7)}`
          : " · local"}
      </p>
    </div>
  );
}
