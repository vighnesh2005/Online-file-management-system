"use client";
import { useEffect, useState } from "react";
import { useAppContext } from "@/context/context";

export default function LogsPage() {
  const { token, hydrated } = useAppContext();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(50);

  const fetchLogs = async (off = offset, lim = limit) => {
    if (!token) return;
    try {
      setLoading(true);
      setError("");
      const res = await fetch(`http://127.0.0.1:8000/logs/me?offset=${off}&limit=${lim}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.message || "Failed to load logs");
      }
      const data = await res.json();
      setLogs(data.logs || []);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hydrated && token) {
      fetchLogs(0, limit);
    }
  }, [hydrated, token]);

  const getActorEmail = (details) => {
    const m = /(\bactor_email=)([^|\s]+)/.exec(details || "");
    return m ? m[2] : null;
  };

  const cleanDetails = (details) => {
    if (!details) return "-";
    return details
      .replace(/\s*\|\s*actor_id=[^|]+/g, "")
      .replace(/\s*actor_email=[^|]+/g, "")
      .trim() || "-";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <h1 className="text-xl font-semibold">My Activity Logs</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => fetchLogs(offset, limit)}
              className="px-3 py-1.5 border rounded-lg text-sm hover:bg-gray-50"
            >
              Refresh
            </button>
            <select
              className="px-2 py-1.5 border rounded-lg text-sm"
              value={limit}
              onChange={(e) => {
                const v = parseInt(e.target.value, 10);
                setLimit(v);
                setOffset(0);
                fetchLogs(0, v);
              }}
            >
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {loading && <div className="text-gray-600">Loading logs...</div>}
        {error && (
          <div className="text-red-600 mb-4">{error}</div>
        )}
        {!loading && !error && logs.length === 0 && (
          <div className="text-gray-600">No logs found.</div>
        )}
        {!loading && !error && logs.length > 0 && (
          <div className="overflow-x-auto bg-white border rounded-lg">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="text-left px-4 py-2">Time</th>
                  <th className="text-left px-4 py-2">Action</th>
                  <th className="text-left px-4 py-2">Resource</th>
                  <th className="text-left px-4 py-2">ID</th>
                  <th className="text-left px-4 py-2">Details</th>
                  <th className="text-left px-4 py-2">Actor Email</th>
                  <th className="text-left px-4 py-2">User</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.log_id} className="border-b last:border-0">
                    <td className="px-4 py-2 whitespace-nowrap">{new Date(l.created_at).toLocaleString()}</td>
                    <td className="px-4 py-2">{l.action}</td>
                    <td className="px-4 py-2">{l.resource_type || "-"}</td>
                    <td className="px-4 py-2">{l.resource_id ?? "-"}</td>
                    <td className="px-4 py-2 max-w-[320px] truncate" title={cleanDetails(l.details)}>{cleanDetails(l.details)}</td>
                    <td className="px-4 py-2">{getActorEmail(l.details) || "-"}</td>
                    <td className="px-4 py-2">{l.username || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <div className="flex items-center justify-between mt-4">
          <button
            className="px-3 py-1.5 border rounded-lg text-sm disabled:opacity-50"
            onClick={() => {
              const next = Math.max(0, offset - limit);
              setOffset(next);
              fetchLogs(next, limit);
            }}
            disabled={offset === 0}
          >
            Previous
          </button>
          <div className="text-xs text-gray-600">Offset: {offset} • Limit: {limit}</div>
          <button
            className="px-3 py-1.5 border rounded-lg text-sm"
            onClick={() => {
              const next = offset + limit;
              setOffset(next);
              fetchLogs(next, limit);
            }}
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
