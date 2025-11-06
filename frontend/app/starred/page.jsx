"use client";
import { useEffect, useState } from "react";
import DriveLayout from "@/components/common/DriveLayout";
import { useAppContext } from "@/context/context";
import axios from "axios";
import Link from "next/link";
import Image from "next/image";
import { Star } from "lucide-react";

export default function StarredPage() {
  const { token, hydrated, isLoggedIn } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [files, setFiles] = useState([]);
  const [folders, setFolders] = useState([]);

  const load = async () => {
    if (!token) return;
    setLoading(true);
    setError("");
    try {
      const res = await axios.get("http://127.0.0.1:8000/api/starred", {
        headers: { Authorization: `Bearer ${token}` },
      });
      setFiles(res.data?.files || []);
      setFolders(res.data?.folders || []);
    } catch (e) {
      setError(e?.response?.data?.detail || e?.message || "Failed to load starred items");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (hydrated && isLoggedIn && token) {
      load();
    }
  }, [hydrated, token, isLoggedIn]);

  const unstarFile = async (fileId) => {
    try {
      await axios.delete("http://127.0.0.1:8000/api/star", {
        headers: { Authorization: `Bearer ${token}` },
        params: { file_id: fileId },
      });
      setFiles((prev) => prev.filter((f) => f.file_id !== fileId));
    } catch (e) {}
  };

  const unstarFolder = async (folderId) => {
    try {
      await axios.delete("http://127.0.0.1:8000/api/star", {
        headers: { Authorization: `Bearer ${token}` },
        params: { folder_id: folderId },
      });
      setFolders((prev) => prev.filter((f) => f.folder_id !== folderId));
    } catch (e) {}
  };

  return (
    <DriveLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2">Starred</h1>
          <p className="text-sm sm:text-base text-gray-600">Your pinned files and folders</p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded mb-4">{error}</div>
        )}

        {loading ? (
          <div className="bg-white rounded border border-gray-200 p-8 text-center">Loading...</div>
        ) : (
          <div className="space-y-8">
            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-3">Folders</h2>
              {folders.length === 0 ? (
                <div className="text-gray-500 text-sm">No starred folders</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {folders.map((f) => (
                    <div key={f.folder_id} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-blue-100 rounded-lg">
                            <Image src="/folder.svg" alt="Folder" width={24} height={24} />
                          </div>
                          <div className="font-medium text-gray-900 truncate" title={f.folder_name}>{f.folder_name}</div>
                        </div>
                        <button
                          onClick={() => unstarFolder(f.folder_id)}
                          className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg"
                          title="Unstar"
                        >
                          <Star className="w-4 h-4" strokeWidth={1.5} fill="currentColor" />
                        </button>
                      </div>
                      <Link href={`/folder/${f.folder_id}`} className="text-sm text-blue-600 hover:underline">Open</Link>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div>
              <h2 className="text-lg font-medium text-gray-900 mb-3">Files</h2>
              {files.length === 0 ? (
                <div className="text-gray-500 text-sm">No starred files</div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {files.map((f) => (
                    <div key={f.file_id} className="bg-white border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-3">
                          <div className="p-2 bg-green-100 rounded-lg">
                            <Image src="/file.svg" alt="File" width={24} height={24} />
                          </div>
                          <div className="font-medium text-gray-900 truncate" title={f.file_name}>{f.file_name}</div>
                        </div>
                        <button
                          onClick={() => unstarFile(f.file_id)}
                          className="p-2 text-yellow-600 hover:bg-yellow-50 rounded-lg"
                          title="Unstar"
                        >
                          <Star className="w-4 h-4" strokeWidth={1.5} fill="currentColor" />
                        </button>
                      </div>
                      <Link href={`/view/${f.file_id}`} className="text-sm text-blue-600 hover:underline">Preview</Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DriveLayout>
  );
}
