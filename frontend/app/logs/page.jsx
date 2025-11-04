"use client";
import { useEffect, useState } from "react";
import { useAppContext } from "@/context/context";
import { Download, Filter, AlertTriangle, ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/common/Navbar";

export default function LogsPage() {
  const { token, hydrated } = useAppContext();
  const router = useRouter();
  const [logs, setLogs] = useState([]);
  const [securityLogs, setSecurityLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [securityLoading, setSecurityLoading] = useState(false);
  const [error, setError] = useState("");
  const [offset, setOffset] = useState(0);
  const [limit, setLimit] = useState(50);
  const [showFilters, setShowFilters] = useState(false);
  const [showSecurity, setShowSecurity] = useState(false);
  
  // Filters
  const [actionFilter, setActionFilter] = useState("");
  const [resourceTypeFilter, setResourceTypeFilter] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const fetchLogs = async (off = offset, lim = limit, applyFilters = true) => {
    if (!token) return;
    try {
      setLoading(true);
      setError("");
      
      let url = `http://127.0.0.1:8000/logs/me?offset=${off}&limit=${lim}`;
      
      if (applyFilters) {
        if (actionFilter) url += `&action=${encodeURIComponent(actionFilter)}`;
        if (resourceTypeFilter) url += `&resource_type=${encodeURIComponent(resourceTypeFilter)}`;
        if (startDate) url += `&start_date=${startDate}`;
        if (endDate) url += `&end_date=${endDate}`;
      }
      
      const res = await fetch(url, {
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

  const fetchSecurityLogs = async () => {
    if (!token) return;
    try {
      setSecurityLoading(true);
      const res = await fetch(`http://127.0.0.1:8000/logs/me/security?limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load security logs");
      const data = await res.json();
      setSecurityLogs(data.logs || []);
    } catch (e) {
      console.error(e);
    } finally {
      setSecurityLoading(false);
    }
  };

  useEffect(() => {
    if (hydrated && token) {
      fetchLogs(0, limit);
      fetchSecurityLogs();
    }
  }, [hydrated, token]);

  const handleExportCSV = async () => {
    if (!token) return;
    try {
      let url = `http://127.0.0.1:8000/logs/me/export?`;
      const params = new URLSearchParams();
      
      if (actionFilter) params.append('action', actionFilter);
      if (resourceTypeFilter) params.append('resource_type', resourceTypeFilter);
      if (startDate) params.append('start_date', startDate);
      if (endDate) params.append('end_date', endDate);
      
      const res = await fetch(url + params.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      
      if (!res.ok) throw new Error("Export failed");
      
      const blob = await res.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `activity_logs_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      a.remove();
    } catch (e) {
      alert("Failed to export logs: " + e.message);
    }
  };

  const clearFilters = () => {
    setActionFilter("");
    setResourceTypeFilter("");
    setStartDate("");
    setEndDate("");
    setOffset(0);
    fetchLogs(0, limit, false);
  };

  const applyFilters = () => {
    setOffset(0);
    fetchLogs(0, limit, true);
  };

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

  const getActionBadgeClass = (action) => {
    if (action.includes('delete') || action.includes('permanent')) return 'bg-red-100 text-red-700';
    if (action.includes('share') || action.includes('update')) return 'bg-yellow-100 text-yellow-700';
    if (action.includes('create') || action.includes('upload')) return 'bg-green-100 text-green-700';
    return 'bg-blue-100 text-blue-700';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2">Activity Logs</h1>
          <p className="text-sm sm:text-base text-gray-600">Track all actions performed on your files and folders</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b border-gray-200">
          <button
            onClick={() => setShowSecurity(false)}
            className={`px-4 py-2 border-b-2 font-medium transition-colors ${
              !showSecurity ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            All Logs
          </button>
          <button
            onClick={() => setShowSecurity(true)}
            className={`px-4 py-2 border-b-2 font-medium transition-colors flex items-center gap-2 ${
              showSecurity ? 'border-red-600 text-red-600' : 'border-transparent text-gray-600 hover:text-gray-900'
            }`}
          >
            <AlertTriangle className="w-4 h-4" strokeWidth={1.5} />
            Security Highlights
          </button>
        </div>

        {/* Security Highlights */}
        {showSecurity && (
          <div className="bg-white rounded border border-gray-200 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600" strokeWidth={1.5} />
                Security-Relevant Actions
              </h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              Destructive actions (delete, permanent delete) and share changes (create, update, delete shares)
            </p>
            
            {securityLoading && <div className="text-gray-600">Loading...</div>}
            {!securityLoading && securityLogs.length === 0 && (
              <div className="text-gray-600">No security-relevant logs found.</div>
            )}
            {!securityLoading && securityLogs.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Time</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Action</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Resource</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Details</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {securityLogs.map((l) => (
                      <tr key={l.log_id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 whitespace-nowrap text-gray-900">
                          {new Date(l.created_at).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${getActionBadgeClass(l.action)}`}>
                            {l.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">
                          {l.resource_type || "-"} #{l.resource_id ?? "-"}
                        </td>
                        <td className="px-4 py-3 text-gray-600 max-w-md truncate" title={cleanDetails(l.details)}>
                          {cleanDetails(l.details)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* All Logs with Filters */}
        {!showSecurity && (
          <>
            {/* Action Bar */}
            <div className="bg-white rounded border border-gray-200 p-4 mb-6">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setShowFilters(!showFilters)}
                    className={`flex items-center gap-2 px-4 py-2 rounded transition-colors ${
                      showFilters ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    <Filter className="w-4 h-4" strokeWidth={1.5} />
                    <span className="hidden sm:inline">Filters</span>
                  </button>
                  <button
                    onClick={handleExportCSV}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                  >
                    <Download className="w-4 h-4" strokeWidth={1.5} />
                    <span className="hidden sm:inline">Export CSV</span>
                  </button>
                  <button
                    onClick={() => fetchLogs(offset, limit)}
                    className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                  >
                    Refresh
                  </button>
                </div>
                <select
                  className="px-3 py-2 border border-gray-300 rounded text-sm"
                  value={limit}
                  onChange={(e) => {
                    const v = parseInt(e.target.value, 10);
                    setLimit(v);
                    setOffset(0);
                    fetchLogs(0, v);
                  }}
                >
                  <option value={20}>20 per page</option>
                  <option value={50}>50 per page</option>
                  <option value={100}>100 per page</option>
                  <option value={200}>200 per page</option>
                </select>
              </div>

              {/* Filters Panel */}
              {showFilters && (
                <div className="mt-4 pt-4 border-t border-gray-200 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Action</label>
                    <input
                      type="text"
                      value={actionFilter}
                      onChange={(e) => setActionFilter(e.target.value)}
                      placeholder="e.g., upload, delete"
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Resource Type</label>
                    <select
                      value={resourceTypeFilter}
                      onChange={(e) => setResourceTypeFilter(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    >
                      <option value="">All</option>
                      <option value="file">File</option>
                      <option value="folder">Folder</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
                    <input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                    />
                  </div>
                  <div className="sm:col-span-2 lg:col-span-4 flex gap-2">
                    <button
                      onClick={applyFilters}
                      className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      Apply Filters
                    </button>
                    <button
                      onClick={clearFilters}
                      className="px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors"
                    >
                      Clear Filters
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Logs Table */}
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded mb-4">
                {error}
              </div>
            )}
            
            {loading && (
              <div className="bg-white rounded border border-gray-200 p-8 text-center">
                <div className="w-12 h-12 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-gray-600">Loading logs...</p>
              </div>
            )}
            
            {!loading && logs.length === 0 && (
              <div className="bg-white rounded border border-gray-200 p-8 text-center text-gray-600">
                No logs found with the current filters.
              </div>
            )}
            
            {!loading && logs.length > 0 && (
              <>
                {/* Desktop Table */}
                <div className="hidden md:block bg-white rounded border border-gray-200 overflow-hidden mb-6">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Time</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Action</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Resource</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Details</th>
                        <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">User</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {logs.map((l) => (
                        <tr key={l.log_id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 whitespace-nowrap text-gray-900">
                            {new Date(l.created_at).toLocaleString()}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${getActionBadgeClass(l.action)}`}>
                              {l.action}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {l.resource_type || "-"} #{l.resource_id ?? "-"}
                          </td>
                          <td className="px-4 py-3 text-gray-600 max-w-md truncate" title={cleanDetails(l.details)}>
                            {cleanDetails(l.details)}
                          </td>
                          <td className="px-4 py-3 text-gray-900">{l.username || "-"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Mobile Cards */}
                <div className="md:hidden space-y-4 mb-6">
                  {logs.map((l) => (
                    <div key={l.log_id} className="bg-white rounded border border-gray-200 p-4">
                      <div className="flex items-start justify-between mb-2">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded ${getActionBadgeClass(l.action)}`}>
                          {l.action}
                        </span>
                        <span className="text-xs text-gray-500">
                          {new Date(l.created_at).toLocaleString()}
                        </span>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-gray-500">Resource:</span>
                          <span className="text-gray-900">{l.resource_type || "-"} #{l.resource_id ?? "-"}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-gray-500">User:</span>
                          <span className="text-gray-900">{l.username || "-"}</span>
                        </div>
                        {cleanDetails(l.details) !== "-" && (
                          <div>
                            <span className="text-gray-500">Details:</span>
                            <p className="text-gray-900 mt-1">{cleanDetails(l.details)}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-white rounded border border-gray-200 p-4">
                  <button
                    className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
                    onClick={() => {
                      const next = Math.max(0, offset - limit);
                      setOffset(next);
                      fetchLogs(next, limit);
                    }}
                    disabled={offset === 0}
                  >
                    Previous
                  </button>
                  <div className="text-sm text-gray-600">
                    Showing {offset + 1} - {offset + logs.length}
                  </div>
                  <button
                    className="w-full sm:w-auto px-4 py-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => {
                      const next = offset + limit;
                      setOffset(next);
                      fetchLogs(next, limit);
                    }}
                    disabled={logs.length < limit}
                  >
                    Next
                  </button>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
