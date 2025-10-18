'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, X, Download, Share2 } from 'lucide-react';
import axios from 'axios';
import Image from 'next/image';

export default function TokenSearch({ isOpen, onClose, token }) {
  const [searchToken, setSearchToken] = useState('');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const router = useRouter();

  const handleSearch = async () => {
    if (!searchToken.trim()) return;
    
    setLoading(true);
    setError(null);
    setResults(null);
    
    try {
      const response = await axios.get(
        `http://127.0.0.1:8000/shares/get_shares?token=${encodeURIComponent(searchToken)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setResults(response.data);
      router.push(`/shared/${encodeURIComponent(searchToken)}`);
      onClose?.();
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid or expired share link');
    } finally {
      setLoading(false);
    }
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
          if (done) {
            writer.close();
            return;
          }
          await writer.write(value);
          await pump();
        };
        await pump();
      }

      console.log("✅ Download completed!");
    } catch (err) {
      console.error("Download failed:", err);
      alert("Something went wrong while downloading the file");
    }
  };

  const handleFolderDownload = async (folderId, folderName = "folder.zip") => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/folders/download_folder/${folderId}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const error = await res.json();
        alert(error.detail || error.message || "Download failed");
        return;
      }

      const streamSaverModule = await import("streamsaver");
      const fileStream = streamSaverModule.default.createWriteStream(folderName);
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

      console.log("✅ Folder download completed!");
    } catch (err) {
      console.error("Folder download failed:", err);
      alert("Something went wrong while downloading the folder");
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Search className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Search Share Token</h2>
              <p className="text-sm text-gray-500">Enter a share token to view shared content</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Search Input */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Share Token
            </label>
            <div className="flex gap-3">
              <input
                type="text"
                value={searchToken}
                onChange={(e) => setSearchToken(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Enter share token..."
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
              <button
                onClick={handleSearch}
                disabled={loading || !searchToken.trim()}
                className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    Searching...
                  </>
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    Search
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Results */}
          {error && (
            <div className="p-4 bg-red-50 border border-red-200 rounded-lg mb-6">
              <div className="flex items-center gap-2 text-red-800">
                <X className="w-5 h-5" />
                <span className="font-medium">Error</span>
              </div>
              <p className="text-red-700 mt-1">{error}</p>
            </div>
          )}

          {results && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-green-800 mb-4">
                <Share2 className="w-5 h-5" />
                <span className="font-medium">Shared Content Found</span>
              </div>

              {/* Folders */}
              {results.folders?.map(folder => (
                <div key={folder.folder_id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-blue-100 rounded-lg">
                        <Image src="/folder.svg" alt="Folder" width={24} height={24} />
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">{folder.folder_name}</h3>
                        <p className="text-sm text-gray-500">Folder</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleFolderDownload(folder.folder_id, folder.folder_name + ".zip")}
                      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  </div>
                </div>
              ))}

              {/* Files */}
              {results.files?.map(file => (
                <div key={file.file_id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="p-3 bg-green-100 rounded-lg">
                        <Image src="/file.svg" alt="File" width={24} height={24} />
                      </div>
                      <div>
                        <h3 className="text-lg font-medium text-gray-900">{file.file_name}</h3>
                        <p className="text-sm text-gray-500">File</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDownload(file.file_id, file.file_name)}
                      className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <Download className="w-4 h-4" />
                      Download
                    </button>
                  </div>
                </div>
              ))}

              {/* Empty State */}
              {(!results.folders?.length && !results.files?.length) && (
                <div className="text-center py-8">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <Share2 className="w-8 h-8 text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No content found</h3>
                  <p className="text-gray-500">This share doesn't contain any files or folders.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

