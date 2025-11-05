'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { useAppContext } from '@/context/context';
import DriveLayout from '@/components/common/DriveLayout';
import { Download, Folder as FolderIcon, File as FileIcon, ArrowLeft, Eye, Pencil, Trash2, Upload } from 'lucide-react';
import axios from 'axios';
import Image from 'next/image';
import Link from 'next/link';

export default function SharedTokenPage() {
  const { token: shareToken } = useParams();
  const router = useRouter();
  const { token, hydrated, isLoggedIn } = useAppContext();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [sharedData, setSharedData] = useState(null);
  const [permission, setPermission] = useState('view'); // 'view' or 'edit'
  // Share modals removed for token view
  const searchParams = useSearchParams();
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [childFolders, setChildFolders] = useState([]);
  const [childFiles, setChildFiles] = useState([]);
  const [renameTarget, setRenameTarget] = useState(null);

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

        // Derive permission by querying share_details and matching token
        let perm = 'view';
        try {
          if (response.data?.folders?.length) {
            const fid = response.data.folders[0].folder_id;
            const det = await axios.get('http://127.0.0.1:8000/shares/share_details', {
              params: { folder_id: fid },
            });
            const match = (det.data?.shares || []).find((s) => s.token === shareToken);
            if (match?.permission) perm = match.permission;
          } else if (response.data?.files?.length) {
            const fileId = response.data.files[0].file_id;
            const det = await axios.get('http://127.0.0.1:8000/shares/share_details', {
              params: { file_id: fileId },
            });
            const match = (det.data?.shares || []).find((s) => s.token === shareToken);
            if (match?.permission) perm = match.permission;
          }
        } catch (e) {
          // ignore and keep default 'view'
        }
        setPermission(perm);
      } catch (err) {
        console.error('Fetch error:', err);
        setError(err.response?.data?.detail || 'Failed to load shared content. The token may be invalid or expired.');
      } finally {
        setLoading(false);
      }
    };

    fetchSharedContent();
  }, [shareToken, token, hydrated, isLoggedIn, router]);

  // Browse inside shared folder using query param folder_id (stay in share mode)
  useEffect(() => {
    if (!hydrated) return;
    if (!token || !isLoggedIn) return;

    const idParam = searchParams.get('folder_id');
    if (!idParam) {
      setCurrentFolderId(null);
      setChildFiles([]);
      setChildFolders([]);
      return;
    }

    const fid = Number(idParam);
    if (Number.isNaN(fid)) return;

    setCurrentFolderId(fid);

    const fetchChildren = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`http://127.0.0.1:8000/folders/get_all_children/${fid}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const filesArr = res.data.files || [];
        const foldersArr = res.data.folders || [];
        // Defensive: do not show the current folder as a child if backend ever returns it
        setChildFolders(foldersArr.filter(f => f?.folder_id !== fid));
        setChildFiles(filesArr);
      } catch (e) {
        console.error(e);
        setError(e.response?.data?.detail || 'Failed to load folder contents');
      } finally {
        setLoading(false);
      }
    };

    fetchChildren();
  }, [searchParams, hydrated, token, isLoggedIn]);

  const openFolder = (id) => {
    router.push(`/shared/${encodeURIComponent(shareToken)}?folder_id=${id}`);
  };

  // ===== Actions (component scope) =====
  const handleRenameFile = (file) => {
    if (permission !== 'edit') return;
    setRenameTarget({ type: 'file', id: file.file_id, name: file.file_name, parent_id: currentFolderId || 0 });
  };

  const handleRenameFolder = (folder) => {
    if (permission !== 'edit') return;
    setRenameTarget({ type: 'folder', id: folder.folder_id, name: folder.folder_name, parent_id: currentFolderId || 0 });
  };

  const handleRenameSubmit = async () => {
    if (!renameTarget) return;
    try {
      if (renameTarget.type === 'file') {
        const formData = new FormData();
        formData.append('file_id', renameTarget.id);
        formData.append('file_name', renameTarget.name);
        const res = await axios.put('http://127.0.0.1:8000/files/rename_file', formData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 200) {
          if (currentFolderId) {
            setChildFiles(prev => prev.map(f => f.file_id === renameTarget.id ? { ...f, file_name: renameTarget.name } : f));
          } else {
            setSharedData(prev => ({ ...prev, files: (prev?.files || []).map(f => f.file_id === renameTarget.id ? { ...f, file_name: renameTarget.name } : f) }));
          }
        }
      } else if (renameTarget.type === 'folder') {
        const formData = new FormData();
        formData.append('folder_id', renameTarget.id);
        formData.append('folder_name', renameTarget.name);
        formData.append('parent_id', renameTarget.parent_id || 0);
        const res = await axios.put('http://127.0.0.1:8000/folders/folder_rename', formData, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (res.status === 200) {
          if (currentFolderId) {
            setChildFolders(prev => prev.map(f => f.folder_id === renameTarget.id ? { ...f, folder_name: renameTarget.name } : f));
          } else {
            setSharedData(prev => ({ ...prev, folders: (prev?.folders || []).map(f => f.folder_id === renameTarget.id ? { ...f, folder_name: renameTarget.name } : f) }));
          }
        }
      }
    } catch (e) {
      // keep silent UI, errors can be surfaced as needed
    } finally {
      setRenameTarget(null);
    }
  };

  const handleReupload = async (file) => {
    try {
      if (permission !== 'edit') {
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
          if (updated) {
            if (currentFolderId) {
              setChildFiles((prev) => prev.map((f) => f.file_id === file.file_id ? { ...f, file_name: updated.file_name, file_size: updated.file_size, updated_at: updated.updated_at } : f));
            } else {
              setSharedData((prev) => ({ ...prev, files: (prev?.files || []).map((f) => f.file_id === file.file_id ? { ...f, file_name: updated.file_name, updated_at: updated.updated_at } : f) }));
            }
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

  // Share handlers removed for token view

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
        formData.append('file_ids', String(item.file_id));
      } else if (item.folder_id) {
        formData.append('folder_ids', String(item.folder_id));
      }
      await axios.post('http://127.0.0.1:8000/folders/bulk_delete', formData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      // Refresh the view
      if (currentFolderId) {
        const res = await axios.get(`http://127.0.0.1:8000/folders/get_all_children/${currentFolderId}`,{ headers: { Authorization: `Bearer ${token}` }});
        const filesArr = res.data.files || [];
        const foldersArr = res.data.folders || [];
        setChildFolders(foldersArr.filter(f => f?.folder_id !== currentFolderId));
        setChildFiles(filesArr);
      } else {
        const response = await axios.get(
          `http://127.0.0.1:8000/shares/get_shares?token=${encodeURIComponent(shareToken)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setSharedData(response.data);
      }
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
        {/* When browsing inside a shared folder */}
        {currentFolderId && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div className="text-sm text-gray-600">Shared view</div>
              <div className="flex items-center gap-2">
                <Link href={`/shared/${encodeURIComponent(shareToken)}`} className="text-sm text-blue-600 hover:underline">Back to shared root</Link>
              </div>
            </div>

            {childFolders?.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Folders ({childFolders.length})</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                  {childFolders.map((folder) => (
                    <div key={folder.folder_id} className="group bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-black transition-shadow">
                      <div className="p-4">
                        <div className="flex flex-col items-center text-center">
                          <div className="p-3 bg-blue-100 rounded-lg mb-3 group-hover:bg-blue-200 transition-colors">
                            <Image src="/folder.svg" alt="Folder" width={32} height={32} />
                          </div>
                          <h3 className="font-medium text-gray-900 text-sm truncate w-full" title={folder.folder_name}>{folder.folder_name}</h3>
                          <p className="text-xs text-gray-500 mt-1">Folder</p>
                        </div>

                        <div className="mt-4 flex flex-wrap justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openFolder(folder.folder_id)} className="px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded-lg">Open</button>
                          <button
                            onClick={() => handleFolderDownload(folder.folder_id, folder.folder_name + '.zip')}
                            className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Download"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          {permission === 'edit' && (
                            <>
                              <button onClick={() => handleRenameFolder(folder)} className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Rename"><Pencil className="w-4 h-4" /></button>
                              <button onClick={() => handleDelete(folder)} className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Click to Open in share mode */}
                      <button onClick={() => openFolder(folder.folder_id)} className="block w-full">
                        <div className="px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-b-lg transition-colors">
                          <p className="text-xs text-gray-600 text-center">Click to open</p>
                        </div>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {childFiles?.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Files ({childFiles.length})</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                  {childFiles.map((file) => (
                    <div key={file.file_id} className="group bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-black transition-shadow">
                      <div className="p-4">
                        <div className="flex flex-col items-center text-center">
                          <div className="p-3 bg-green-100 rounded-lg mb-3 group-hover:bg-green-200 transition-colors">
                            <Image src="/file.svg" alt="File" width={32} height={32} />
                          </div>
                          <h3 className="font-medium text-gray-900 text-sm truncate w-full" title={file.file_name}>{file.file_name}</h3>
                          <p className="text-xs text-gray-500 mt-1">File</p>
                        </div>

                        <div className="mt-4 flex flex-wrap justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Link href={`/view/${file.file_id}`}>
                            <button className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View"><Eye className="w-4 h-4" /></button>
                          </Link>
                          <button onClick={() => handleDownload(file.file_id, file.file_name)} className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors" title="Download"><Download className="w-4 h-4" /></button>
                          {permission === 'edit' && (
                            <>
                              <button onClick={() => handleRenameFile(file)} className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Rename"><Pencil className="w-4 h-4" /></button>
                              <button onClick={() => handleReupload(file)} className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="Reupload"><Upload className="w-4 h-4" /></button>
                              <button onClick={() => handleDelete(file)} className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Shared root summary (only when not browsing inside) */}
        {sharedData && !currentFolderId && (
          <div className="mb-4">
            <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
              permission === 'edit' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
            }`}>
              {permission === 'edit' ? <><Pencil className="w-3 h-3 mr-1" />Can Edit</> : <><Eye className="w-3 h-3 mr-1" />View Only</>}
            </span>
          </div>
        )}

        {sharedData && !currentFolderId && (
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
                          <button onClick={() => openFolder(folder.folder_id)} className="px-3 py-2 text-sm bg-gray-50 hover:bg-gray-100 rounded-lg">Open</button>
                          <button
                            onClick={() => handleFolderDownload(folder.folder_id, folder.folder_name + '.zip')}
                            className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Download"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          {permission === 'edit' && (
                            <>
                              <button onClick={() => handleRenameFolder(folder)} className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Rename"><Pencil className="w-4 h-4" /></button>
                              <button onClick={() => handleDelete(folder)} className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Delete"><Trash2 className="w-4 h-4" /></button>
                            </>
                          )}
                        </div>
                      </div>

                      {/* Click to Open in share mode */}
                      <button onClick={() => openFolder(folder.folder_id)} className="block w-full">
                        <div className="px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-b-lg transition-colors">
                          <p className="text-xs text-gray-600 text-center">Click to open</p>
                        </div>
                      </button>
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
                          <Link href={`/view/${file.file_id}`}>
                            <button className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="View"><Eye className="w-4 h-4" /></button>
                          </Link>
                          {permission === 'edit' && (
                            <button onClick={() => handleRenameFile(file)} className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="Rename"><Pencil className="w-4 h-4" /></button>
                          )}
                          <button
                            onClick={() => handleDownload(file.file_id, file.file_name)}
                            className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                            title="Download"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                          {permission === 'edit' && (
                            <button onClick={() => handleReupload(file)} className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors" title="Reupload"><Upload className="w-4 h-4" /></button>
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

      {/* ===== Rename popup (shared mode) ===== */}
      {renameTarget && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-md shadow-md w-80">
            <h2 className="text-lg font-semibold mb-4">Rename {renameTarget.type}</h2>
            <input
              type="text"
              value={renameTarget.name}
              onChange={e => setRenameTarget({ ...renameTarget, name: e.target.value })}
              className="w-full p-2 border border-gray-300 rounded mb-4"
            />
            <div className="flex justify-end gap-2">
              <button
                onClick={() => setRenameTarget(null)}
                className="px-3 py-1 border rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleRenameSubmit}
                className="px-3 py-1 bg-blue-600 text-white rounded"
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {/* end */}
    </DriveLayout>
  );
}
