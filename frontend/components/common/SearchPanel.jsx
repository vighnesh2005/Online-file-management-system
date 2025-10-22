"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAppContext } from "@/context/context";
import axios from "axios";
import { Search, X, Folder as FolderIcon, File as FileIcon, Download } from "lucide-react";

export default function SearchPanel() {
  const router = useRouter();
  const params = useSearchParams();
  const initialQ = params.get("q") || "";

  const { token, hydrated, isLoggedIn } = useAppContext();

  const [q, setQ] = useState(initialQ);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [folders, setFolders] = useState([]);
  const [files, setFiles] = useState([]);
  const [parentId, setParentId] = useState(null);

  const debounceRef = useRef(null);

  const canSearch = useMemo(() => hydrated && isLoggedIn && token && q.trim().length > 0, [hydrated, isLoggedIn, token, q]);

  useEffect(() => {
    if (!hydrated) return;
    if (!isLoggedIn || !token) {
      router.push("/login");
      return;
    }
  }, [hydrated, isLoggedIn, token, router]);

  const runSearch = async (query) => {
    if (!query?.trim()) {
      setFolders([]);
      setFiles([]);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const url = new URL("http://127.0.0.1:8000/search/items");
      url.searchParams.set("q", query.trim());
      if (parentId !== null && parentId !== undefined && parentId !== "") {
        url.searchParams.set("parent_id", String(parentId));
      }
      const res = await axios.get(url.toString(), {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFolders(res.data?.folders || []);
      setFiles(res.data?.files || []);
    } catch (err) {
      setError(err.response?.data?.detail || "Search failed");
    } finally {
      setLoading(false);
    }
  };

  // Debounce search
  useEffect(() => {
    if (!canSearch) {
      setFolders([]);
      setFiles([]);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => runSearch(q), 350);
    return () => clearTimeout(debounceRef.current);
  }, [q, parentId, canSearch]);

  const onSubmit = (e) => {
    e.preventDefault();
    if (canSearch) runSearch(q);
  };

  const handleDownload = async (file_id, file_name) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/files/download_file/${file_id}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const error = await res.json();
        alert(error.detail || error.message || "Download failed");
        return;
      }
      const streamSaverModule = await import("streamsaver");
      const fileStream = streamSaverModule.default.createWriteStream(file_name);
      const readableStream = res.body;
      if (window.WritableStream && readableStream.pipeTo) {
        await readableStream.pipeTo(fileStream);
      } else {
        const reader = readableStream.getReader();
        const writer = fileStream.getWriter();
        const pump = async () => {
          const { done, value } = await reader.read();
          if (done) { writer.close(); return; }
          await writer.write(value);
          await pump();
        };
        await pump();
      }
    } catch (err) {
      console.error("Download failed:", err);
      alert("Something went wrong while downloading the file");
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Search Controls */}
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search files and folders..."
              className="w-full pl-9 pr-10 py-2 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            {q && (
              <button
                type="button"
                onClick={() => setQ("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-gray-800"
                aria-label="Clear"
                title="Clear"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={!q.trim() || loading}
            className="px-4 h-10 bg-black text-white hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {loading ? "Searching..." : "Search"}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-600">Parent Folder ID (optional)</label>
          <input
            type="number"
            value={parentId ?? ""}
            onChange={(e) => setParentId(e.target.value)}
            placeholder="e.g., 0 for root"
            className="w-44 px-3 py-2 border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </form>

      {error && (
        <div className="mt-4 p-3 border border-red-300 bg-red-50 text-red-700">{error}</div>
      )}

      {/* Results */}
      {(folders.length > 0 || files.length > 0) && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Folders */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Folders ({folders.length})</h3>
            <div className="space-y-2">
              {folders.map((f) => (
                <button
                  key={f.folder_id}
                  onClick={() => router.push(`/folder/${f.folder_id}`)}
                  className="w-full text-left flex items-center justify-between p-3 border border-gray-200 hover:border-black transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100">
                      <FolderIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm text-gray-900">{f.folder_name}</div>
                      <div className="text-xs text-gray-500">folder_id: {f.folder_id}</div>
                    </div>
                  </div>
                  <div className="text-xs text-gray-500">parent: {f.parent_id}</div>
                </button>
              ))}
              {folders.length === 0 && (
                <div className="text-sm text-gray-500">No folders found.</div>
              )}
            </div>
          </div>

          {/* Files */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 mb-2">Files ({files.length})</h3>
            <div className="space-y-2">
              {files.map((f) => (
                <div
                  key={f.file_id}
                  className="w-full flex items-center justify-between p-3 border border-gray-200 hover:border-black transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-gray-100">
                      <FileIcon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-sm text-gray-900">{f.file_name}</div>
                      <div className="text-xs text-gray-500">file_id: {f.file_id}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => router.push(`/folder/${f.parent_id ?? 0}`)}
                      className="px-2 h-8 border border-gray-300 hover:bg-gray-100 text-sm"
                    >
                      Open Location
                    </button>
                    <button
                      onClick={() => handleDownload(f.file_id, f.file_name)}
                      className="px-2 h-8 border border-gray-300 hover:bg-gray-100 flex items-center gap-1 text-sm"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  </div>
                </div>
              ))}
              {files.length === 0 && (
                <div className="text-sm text-gray-500">No files found.</div>
              )}
            </div>
          </div>
        </div>
      )}

      {!loading && !error && folders.length === 0 && files.length === 0 && q.trim() && (
        <div className="mt-6 text-sm text-gray-500">No results for "{q}"</div>
      )}
    </div>
  );
}
