"use client";
import { useEffect, useMemo, useState } from "react";
import DriveLayout from "@/components/common/DriveLayout";
import { useAppContext } from "@/context/context";
import { BarChart3, PieChart, FolderTree, ChevronRight, RotateCcw } from "lucide-react";

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return "0 B";
  const sizes = ["B", "KB", "MB", "GB", "TB"]; 
  if (bytes === 0) return "0 B"; 
  const i = Math.floor(Math.log(bytes) / Math.log(1024)); 
  const val = bytes / Math.pow(1024, i); 
  return `${val.toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`; 
}

function PercentBar({ value, className = "bg-blue-600" }) {
  const clamped = Math.max(0, Math.min(100, value || 0));
  return (
    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
      <div className={`h-full ${className}`} style={{ width: `${clamped}%` }} />
    </div>
  );
}

export default function StorageInsightsPage() {
  const { token, hydrated } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState(null);

  // Drilldown state
  const [trail, setTrail] = useState([{ id: 0, name: "Root" }]);
  const currentFolder = trail[trail.length - 1];
  const [children, setChildren] = useState([]);
  const [drillLoading, setDrillLoading] = useState(false);

  const fetchSummary = async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("http://127.0.0.1:8000/files/storage/summary", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Failed to load storage summary");
      const data = await res.json();
      setSummary(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchBreakdown = async (folderId) => {
    if (!token) return;
    setDrillLoading(true);
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/files/storage/folder_breakdown?folder_id=${folderId}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (!res.ok) throw new Error("Failed to load folder breakdown");
      const data = await res.json();
      setChildren(data.children || []);
      // Update displayed name if root -> keep Root
      if (folderId !== 0 && data.folder_name) {
        setTrail((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.id === folderId && last.name !== data.folder_name) {
            const next = prev.slice();
            next[next.length - 1] = { id: folderId, name: data.folder_name };
            return next;
          }
          return prev;
        });
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setDrillLoading(false);
    }
  };

  useEffect(() => {
    if (hydrated && token) {
      fetchSummary();
      fetchBreakdown(0);
    }
  }, [hydrated, token]);

  const totalUsed = summary?.total_used_bytes || 0;
  const limitBytes = summary?.limit_bytes || 0;
  const percentUsed = summary?.percent_used || 0;

  const topTypes = useMemo(() => {
    const list = summary?.by_type || [];
    return list.slice(0, 6);
  }, [summary]);

  const topFolders = useMemo(() => {
    const list = summary?.by_folder || [];
    return list.slice(0, 8);
  }, [summary]);

  const onEnterFolder = (id, name) => {
    setTrail((t) => [...t, { id, name }]);
    fetchBreakdown(id);
  };

  const onBreadcrumbClick = (index) => {
    const target = trail[index];
    setTrail(trail.slice(0, index + 1));
    fetchBreakdown(target.id);
  };

  return (
    <DriveLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2">Storage Insights</h1>
          <p className="text-sm sm:text-base text-gray-600">Explainable, human-readable breakdown of your storage usage</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded mb-4">{error}</div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div className="bg-white border border-gray-200 rounded p-4">
            <div className="flex items-center gap-2 mb-2 text-gray-900 font-medium">
              <PieChart className="w-4 h-4" strokeWidth={1.5} /> Overall Usage
            </div>
            {loading ? (
              <div className="h-2 bg-gray-200 rounded" />
            ) : (
              <>
                <PercentBar value={percentUsed} />
                <div className="text-sm text-gray-600 mt-2">
                  {formatBytes(totalUsed)} of {formatBytes(limitBytes)} used ({percentUsed}%)
                </div>
              </>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded p-4">
            <div className="flex items-center gap-2 mb-2 text-gray-900 font-medium">
              <BarChart3 className="w-4 h-4" strokeWidth={1.5} /> Top Types
            </div>
            {loading ? (
              <div className="h-2 bg-gray-200 rounded" />
            ) : (
              <div className="space-y-2">
                {topTypes.length === 0 && <div className="text-sm text-gray-500">No files yet</div>}
                {topTypes.map((t) => {
                  const pct = totalUsed > 0 ? Math.round((t.bytes / totalUsed) * 100) : 0;
                  return (
                    <div key={t.extension} className="text-sm">
                      <div className="flex justify-between text-gray-700">
                        <span className="truncate mr-2">.{t.extension}</span>
                        <span className="text-gray-500">{formatBytes(t.bytes)} • {pct}%</span>
                      </div>
                      <PercentBar value={pct} />
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded p-4">
            <div className="flex items-center gap-2 mb-2 text-gray-900 font-medium">
              <FolderTree className="w-4 h-4" strokeWidth={1.5} /> Top Folders
            </div>
            {loading ? (
              <div className="h-2 bg-gray-200 rounded" />
            ) : (
              <div className="space-y-2">
                {(topFolders || []).length === 0 && (
                  <div className="text-sm text-gray-500">No folders yet</div>
                )}
                {topFolders.map((f) => {
                  const pct = totalUsed > 0 ? Math.round((f.bytes / totalUsed) * 100) : 0;
                  return (
                    <div key={`${f.folder_id}-${f.folder_name}`} className="text-sm">
                      <div className="flex justify-between text-gray-700">
                        <span className="truncate mr-2">{f.folder_name}</span>
                        <span className="text-gray-500">{formatBytes(f.bytes)} • {pct}%</span>
                      </div>
                      <PercentBar value={pct} className="bg-emerald-600" />
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded p-4 mb-6">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-gray-900 font-medium">
              <BarChart3 className="w-4 h-4" strokeWidth={1.5} /> Usage Over Time (by month)
            </div>
            <button
              className="text-sm px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50"
              onClick={() => fetchSummary()}
              title="Refresh"
            >
              <RotateCcw className="w-4 h-4 inline mr-1" strokeWidth={1.5} /> Refresh
            </button>
          </div>
          {loading ? (
            <div className="h-2 bg-gray-200 rounded" />
          ) : (
            <div className="space-y-2">
              {(summary?.by_month || []).length === 0 && (
                <div className="text-sm text-gray-500">No data</div>
              )}
              {(summary?.by_month || []).map((m) => {
                const pct = totalUsed > 0 ? Math.round((m.bytes / totalUsed) * 100) : 0;
                return (
                  <div key={m.month} className="text-sm">
                    <div className="flex justify-between text-gray-700">
                      <span>{m.month}</span>
                      <span className="text-gray-500">{formatBytes(m.bytes)} • {pct}% ({m.count} files)</span>
                    </div>
                    <PercentBar value={pct} className="bg-indigo-600" />
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-gray-900 font-medium">
              <FolderTree className="w-4 h-4" strokeWidth={1.5} />
              Folder Breakdown
            </div>
            <div className="text-sm text-gray-600">Dive into where space is used</div>
          </div>

          <div className="flex flex-wrap items-center gap-1 text-sm mb-4">
            {trail.map((t, idx) => (
              <div key={`${t.id}-${t.name}`} className="flex items-center">
                <button
                  className={`px-2 py-1 rounded ${idx === trail.length - 1 ? "bg-blue-50 text-blue-700" : "hover:bg-gray-100 text-gray-700"}`}
                  onClick={() => onBreadcrumbClick(idx)}
                >
                  {t.name}
                </button>
                {idx < trail.length - 1 && <ChevronRight className="w-4 h-4 text-gray-400" />}
              </div>
            ))}
          </div>

          {drillLoading ? (
            <div className="text-gray-600">Loading...</div>
          ) : children.length === 0 ? (
            <div className="text-gray-600">No items</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Size</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase w-2/3">Share</th>
                    <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {children.map((c) => {
                    const pct = totalUsed > 0 ? Math.round((c.bytes / totalUsed) * 100) : 0;
                    const isFilesOnly = (c.folder_id === currentFolder.id);
                    return (
                      <tr key={`${c.folder_id}-${c.folder_name}`} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-gray-900">
                          {c.folder_name}
                        </td>
                        <td className="px-4 py-3 text-gray-700">{formatBytes(c.bytes)}</td>
                        <td className="px-4 py-3">
                          <PercentBar value={pct} className="bg-teal-600" />
                        </td>
                        <td className="px-4 py-3">
                          {!isFilesOnly && (
                            <button
                              onClick={() => onEnterFolder(c.folder_id, c.folder_name)}
                              className="inline-flex items-center gap-1 px-3 py-1.5 border border-gray-300 rounded hover:bg-gray-50"
                            >
                              <ChevronRight className="w-4 h-4" strokeWidth={1.5} />
                              Drill down
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DriveLayout>
  );
}
