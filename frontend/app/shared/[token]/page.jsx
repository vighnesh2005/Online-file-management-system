'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAppContext } from '@/context/context';
import DriveLayout from '@/components/common/DriveLayout';
import { Download, Folder as FolderIcon, File as FileIcon, ArrowLeft, Eye, Pencil, Share2, Settings, Trash2 } from 'lucide-react';
import axios from 'axios';
import Image from 'next/image';
import Link from 'next/link';
import ShareModal from '@/components/ShareModal';
import ShareDetailsModal from '@/components/ShareDetailsModal';

export default function SharedTokenPage() {
  const { token: shareToken } = useParams();
  const router = useRouter();
  const { token, hydrated, isLoggedIn } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sharedData, setSharedData] = useState(null);
  const [permission, setPermission] = useState('view'); // 'view' or 'edit'
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareTarget, setShareTarget] = useState(null);
  const [showManageModal, setShowManageModal] = useState(false);
  const [manageTarget, setManageTarget] = useState(null);

  useEffect(() => {
    if (!hydrated) return;
    if (!token || !isLoggedIn) {
      router.push('/login');
      return;
    }

    const fetchSharedContent = async () => {
      try {
        setLoading(true);
        const response = await axios.get(
          `http://127.0.0.1:8000/shares/get_shares?token=${encodeURIComponent(shareToken)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setSharedData(response.data);
        // Set permission from the share data
        setPermission(response.data.permission || 'view');
      } catch (err) {
        console.error('Fetch error:', err);
        setError(err.response?.data?.detail || 'Failed to load shared content. The token may be invalid or expired.');
      } finally {
        setLoading(false);
      }
    };

    fetchSharedContent();
  }, [shareToken, token, hydrated, isLoggedIn, router]);

  const handleShare = (item) => {
    if (permission !== 'edit') {
      alert('You need edit permission to share this item');
      return;
    }
    setShareTarget({
      id: item.file_id || item.folder_id,
      name: item.file_name || item.folder_name,
      type: item.file_id ? 'file' : 'folder'
    });
    setShowShareModal(true);
  };

  const handleShareManagement = (item) => {
    if (permission !== 'edit') {
      alert('You need edit permission to manage shares');
      return;
    }
    setManageTarget({
      id: item.file_id || item.folder_id,
      name: item.file_name || item.folder_name,
      type: item.file_id ? 'file' : 'folder'
    });
    setShowManageModal(true);
  };

  const handleDelete = async (item) => {
    if (permission !== 'edit') {
      alert('You need edit permission to delete this item');
      return;
    }
    
    if (!confirm(`Are you sure you want to delete ${item.file_name || item.folder_name}?`)) {
      return;
    }

    try {
      const formData = new FormData();
      if (item.file_id) {
        formData.append('file_id', item.file_id);
        await axios.delete('http://127.0.0.1:8000/files/delete_file', {
          headers: { Authorization: `Bearer ${token}` },
          data: formData,
        });
      } else {
        formData.append('folder_id', item.folder_id);
        await axios.delete('http://127.0.0.1:8000/folders/delete_folder', {
          headers: { Authorization: `Bearer ${token}` },
          data: formData,
        });
      }
      
      // Refresh the data
      const response = await axios.get(
        `http://127.0.0.1:8000/shares/get_shares?token=${encodeURIComponent(shareToken)}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSharedData(response.data);
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete item');
    }
  };

  const handleDownload = async (file_id, file_name) => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/files/download_file/${file_id}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const error = await res.json();
        alert(error.detail || error.message || 'Download failed');
        return;
      }

      const streamSaverModule = await import('streamsaver');
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
    } catch (err) {
      console.error('Download failed:', err);
      alert('Something went wrong while downloading the file');
    }
  };

  const handleFolderDownload = async (folderId, folderName = 'folder.zip') => {
    try {
      const res = await fetch(`http://127.0.0.1:8000/folders/download_folder/${folderId}`, {
        method: 'GET',
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const error = await res.json();
        alert(error.detail || error.message || 'Download failed');
        return;
      }

      const streamSaverModule = await import('streamsaver');
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
    } catch (err) {
      console.error('Folder download failed:', err);
      alert('Something went wrong while downloading the folder');
    }
  };

  if (!hydrated || loading) {
    return (
      <DriveLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading shared content...</p>
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
          <Link href="/folder/0" className="inline-flex items-center gap-2 text-gray-600 hover:text-gray-900 mb-4">
            <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
            <span>Back to My Drive</span>
          </Link>
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2">Shared Content</h1>
          <p className="text-sm sm:text-base text-gray-600">Viewing content shared via token</p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 text-red-700 rounded-lg">
            {error}
          </div>
        )}

        {/* Permission Badge */}
        {sharedData && (
          <div className="mb-4">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              permission === 'edit' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
            }`}>
              {permission === 'edit' ? <><Pencil className="w-3 h-3 mr-1" />Can Edit</> : <><Eye className="w-3 h-3 mr-1" />View Only</>}
            </span>
          </div>
        )}

        {sharedData && (
          <div className="space-y-6">
            {/* Folders */}
            {sharedData.folders && sharedData.folders.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Folders ({sharedData.folders.length})</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                  {sharedData.folders.map((folder) => (
                    <div
                      key={folder.folder_id}
                      className="group bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-black transition-shadow"
                    >
                      <div className="p-4">
                        <div className="flex flex-col items-center text-center">
                          <div className="p-3 bg-blue-100 rounded-lg mb-3 group-hover:bg-blue-200 transition-colors">
                            <Image src="/folder.svg" alt="Folder" width={32} height={32} />
                          </div>
                          <h3 className="font-medium text-gray-900 text-sm truncate w-full" title={folder.folder_name}>
                            {folder.folder_name}
                          </h3>
                          <p className="text-xs text-gray-500 mt-1">Folder</p>
                        </div>

                        {/* Action Buttons */}
                        <div className="mt-4 flex flex-wrap justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleFolderDownload(folder.folder_id, folder.folder_name + '.zip')}
                            className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Download"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          {permission === 'edit' && (
                            <>
                              <button
                                onClick={() => handleShare(folder)}
                                className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                title="Share"
                              >
                                <Share2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleShareManagement(folder)}
                                className="p-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                title="Manage Shares"
                              >
                                <Settings className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(folder)}
                                className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Click to Open */}
                      <Link href={`/folder/${folder.folder_id}`} className="block">
                        <div className="px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-b-lg transition-colors">
                          <p className="text-xs text-gray-600 text-center">Click to open</p>
                        </div>
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Files */}
            {sharedData.files && sharedData.files.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Files ({sharedData.files.length})</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                  {sharedData.files.map((file) => (
                    <div
                      key={file.file_id}
                      className="group bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-black transition-shadow"
                    >
                      <div className="p-4">
                        <div className="flex flex-col items-center text-center">
                          <div className="p-3 bg-green-100 rounded-lg mb-3 group-hover:bg-green-200 transition-colors">
                            <Image src="/file.svg" alt="File" width={32} height={32} />
                          </div>
                          <h3 className="font-medium text-gray-900 text-sm truncate w-full" title={file.file_name}>
                            {file.file_name}
                          </h3>
                          <p className="text-xs text-gray-500 mt-1">File</p>
                        </div>

                        {/* Action Buttons */}
                        <div className="mt-4 flex flex-wrap justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => handleDownload(file.file_id, file.file_name)}
                            className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Download"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          {permission === 'edit' && (
                            <>
                              <button
                                onClick={() => handleShare(file)}
                                className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors"
                                title="Share"
                              >
                                <Share2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleShareManagement(file)}
                                className="p-2 text-gray-600 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition-colors"
                                title="Manage Shares"
                              >
                                <Settings className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(file)}
                                className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State */}
            {(!sharedData.folders?.length && !sharedData.files?.length) && (
              <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <FileIcon className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">No content found</h3>
                <p className="text-gray-600">This share doesn't contain any files or folders.</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Share Modals */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        item={shareTarget}
        token={token}
        onShareSuccess={() => {
          setShowShareModal(false);
        }}
      />

      {showManageModal && manageTarget && (
        <ShareDetailsModal
          item={manageTarget}
          token={token}
          onClose={() => {
            setShowManageModal(false);
            setManageTarget(null);
          }}
        />
      )}
    </DriveLayout>
  );
}
