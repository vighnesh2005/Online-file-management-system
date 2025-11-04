'use client';

import { useAppContext } from "@/context/context";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { Download, Eye, Folder, File, User, Upload, Pencil } from "lucide-react";
import Link from "next/link";
import DriveLayout from "@/components/common/DriveLayout";

export default function SharedWithMe() {
  const { user, token, isLoggedIn, hydrated } = useAppContext();
  const router = useRouter();
  const [sharedFiles, setSharedFiles] = useState([]);
  const [sharedFolders, setSharedFolders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!hydrated) return;
    if (!token || !isLoggedIn) {
      router.push("/login");
      return;
    }

    const fetchSharedItems = async () => {
      try {
        setLoading(true);
        const res = await axios.get("http://127.0.0.1:8000/shares/shared_with_me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setSharedFiles(res.data.files || []);
        setSharedFolders(res.data.folders || []);
      } catch (err) {
        console.error(err);
        setError("Failed to load shared items");
      } finally {
        setLoading(false);
      }
    };

  const handleRenameFile = async (file) => {
    try {
      if (file.permission !== 'edit') return;
      const newName = prompt('Enter new file name', file.file_name);
      if (!newName || newName === file.file_name) return;
      const formData = new FormData();
      formData.append('file_id', file.file_id);
      formData.append('file_name', newName);
      const res = await axios.put('http://127.0.0.1:8000/files/rename_file', formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.status === 200) {
        setSharedFiles((prev) => prev.map((f) => f.file_id === file.file_id ? { ...f, file_name: newName } : f));
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to rename file');
    }
  };

  const handleReupload = async (file) => {
    try {
      if (file.permission !== 'edit') {
        alert('You do not have permission to reupload this file');
        return;
      }
      const input = document.createElement('input');
      input.type = 'file';
      input.onchange = async (e) => {
        const selected = e.target.files?.[0];
        if (!selected) return;
        try {
          const form = new FormData();
          form.append('file_id', file.file_id);
          form.append('file', selected);
          const res = await axios.put('http://127.0.0.1:8000/files/replace_file', form, {
            headers: { Authorization: `Bearer ${token}` },
          });
          const updated = res.data?.file;
          // Optimistically update list
          if (updated) {
            setSharedFiles((prev) => prev.map((f) => f.file_id === file.file_id ? { ...f, file_name: updated.file_name, file_size: updated.file_size, updated_at: updated.updated_at } : f));
          }
        } catch (err) {
          alert(err.response?.data?.detail || 'Failed to reupload file');
        }
      };
      input.click();
    } catch (e) {
      console.error(e);
    }
  };

    fetchSharedItems();
  }, [hydrated, token, isLoggedIn, router]);

  const formatBytes = (bytes) => {
    if (!bytes && bytes !== 0) return "-";
    const sizes = ["B", "KB", "MB", "GB", "TB"];
    if (bytes === 0) return "0 B";
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const val = bytes / Math.pow(1024, i);
    return `${val.toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const handleDownloadFile = async (fileId, fileName) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/files/download_file/${fileId}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const error = await res.json();
        alert(error.detail || "Download failed");
        return;
      }

      const streamSaver = (await import("streamsaver")).default;
      const fileStream = streamSaver.createWriteStream(fileName);
      const readableStream = res.body;

      if (window.WritableStream && readableStream.pipeTo) {
        await readableStream.pipeTo(fileStream);
      } else {
        const reader = readableStream.getReader();
        const writer = fileStream.getWriter();
        const pump = async () => {
          const { done, value } = await reader.read();
          if (done) {
            writer.close();
            return;
          }
          await writer.write(value);
          await pump();
        };
        await pump();
      }
    } catch (err) {
      console.error(err);
      alert("Download failed");
    }
  };

  if (!hydrated || loading) {
    return (
      <DriveLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading shared items...</p>
          </div>
        </div>
      </DriveLayout>
    );
  }

  return (
    <DriveLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2">Shared with me</h1>
          <p className="text-sm sm:text-base text-gray-600">Files and folders others have shared with you</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* Empty State */}
        {!loading && sharedFiles.length === 0 && sharedFolders.length === 0 && (
          <div className="text-center py-16 bg-white rounded border border-gray-200">
            <User className="w-16 h-16 text-gray-400 mx-auto mb-4" strokeWidth={1.5} />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No shared items</h3>
            <p className="text-gray-600">Items that others share with you will appear here</p>
          </div>
        )}

        {/* Folders Section */}
        {sharedFolders.length > 0 && (
          <div className="mb-8">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Folders ({sharedFolders.length})</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {sharedFolders.map((folder) => (
                <Link
                  key={folder.folder_id}
                  href={`/shared/${encodeURIComponent(folder.share_token)}`}
                  className="group bg-white rounded border border-gray-200 hover:border-blue-600 hover:shadow-md transition-all p-4"
                >
                  <div className="flex items-start gap-3">
                    <div className="p-2 bg-blue-100 rounded flex-shrink-0">
                      <Folder className="w-6 h-6 text-blue-600" strokeWidth={1.5} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate mb-1" title={folder.folder_name}>
                        {folder.folder_name}
                      </h3>
                      <p className="text-xs text-gray-500 truncate mb-2" title={folder.owner_email}>
                        Shared by {folder.owner_name || folder.owner_email}
                      </p>
                      <div className="flex items-center justify-between text-xs text-gray-500">
                        <span className={`px-2 py-1 rounded ${
                          folder.permission === 'edit' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {folder.permission === 'edit' ? 'Can edit' : 'View only'}
                        </span>
                        <span>{formatDate(folder.shared_at)}</span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Files Section */}
        {sharedFiles.length > 0 && (
          <div>
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 mb-4">Files ({sharedFiles.length})</h2>
            
            {/* Desktop Table View */}
            <div className="hidden md:block bg-white rounded border border-gray-200 overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shared By</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Size</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Permission</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shared Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {sharedFiles.map((file) => (
                    <tr key={file.file_id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <File className="w-5 h-5 text-gray-400 flex-shrink-0" strokeWidth={1.5} />
                          <span className="font-medium text-gray-900 truncate max-w-xs" title={file.file_name}>
                            {file.file_name}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{file.owner_name}</div>
                        <div className="text-xs text-gray-500">{file.owner_email}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{formatBytes(file.file_size)}</td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs rounded ${
                          file.permission === 'edit' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                        }`}>
                          {file.permission === 'edit' ? 'Can edit' : 'View only'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{formatDate(file.shared_at)}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <Link href={`/view/${file.file_id}`}>
                            <button className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="View">
                              <Eye className="w-4 h-4" strokeWidth={1.5} />
                            </button>
                          </Link>
                          {file.permission === 'edit' && (
                            <button 
                              onClick={() => handleRenameFile(file)}
                              className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors" title="Rename"
                            >
                              <Pencil className="w-4 h-4" strokeWidth={1.5} />
                            </button>
                          )}
                          {file.permission === 'edit' && (
                            <button 
                              onClick={() => handleReupload(file)}
                              className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded transition-colors" title="Reupload"
                            >
                              <Upload className="w-4 h-4" strokeWidth={1.5} />
                            </button>
                          )}
                          <button 
                            onClick={() => handleDownloadFile(file.file_id, file.file_name)}
                            className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded transition-colors" title="Download"
                          >
                            <Download className="w-4 h-4" strokeWidth={1.5} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden grid grid-cols-1 gap-4">
              {sharedFiles.map((file) => (
                <div key={file.file_id} className="bg-white rounded border border-gray-200 p-4">
                  <div className="flex items-start gap-3 mb-3">
                    <File className="w-5 h-5 text-gray-400 flex-shrink-0 mt-1" strokeWidth={1.5} />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 truncate mb-1" title={file.file_name}>
                        {file.file_name}
                      </h3>
                      <p className="text-sm text-gray-600">{formatBytes(file.file_size)}</p>
                    </div>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Shared by:</span>
                      <span className="text-gray-900 font-medium">{file.owner_name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Permission:</span>
                      <span className={`px-2 py-1 rounded text-xs ${
                        file.permission === 'edit' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {file.permission === 'edit' ? 'Can edit' : 'View only'}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Shared:</span>
                      <span className="text-gray-900">{formatDate(file.shared_at)}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4 pt-4 border-t border-gray-200">
                    <Link href={`/view/${file.file_id}`} className="flex-1">
                      <button className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors">
                        <Eye className="w-4 h-4" strokeWidth={1.5} />
                        View
                      </button>
                    </Link>
                    {file.permission === 'edit' && (
                      <button 
                        onClick={() => handleRenameFile(file)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-blue-600/10 text-blue-700 rounded hover:bg-blue-600/20 transition-colors"
                      >
                        <Pencil className="w-4 h-4" strokeWidth={1.5} />
                        Rename
                      </button>
                    )}
                    {file.permission === 'edit' && (
                      <button 
                        onClick={() => handleReupload(file)}
                        className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                      >
                        <Upload className="w-4 h-4" strokeWidth={1.5} />
                        Reupload
                      </button>
                    )}
                    <button 
                      onClick={() => handleDownloadFile(file.file_id, file.file_name)}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                    >
                      <Download className="w-4 h-4" strokeWidth={1.5} />
                      Download
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </DriveLayout>
  );
}
