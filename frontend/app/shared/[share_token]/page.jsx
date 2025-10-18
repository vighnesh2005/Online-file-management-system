'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useAppContext } from '@/context/context';
import axios from 'axios';
import dynamic from 'next/dynamic';
import { Folder, File, Download, Pencil, Share2, Trash2 } from 'lucide-react';

const streamSaver = dynamic(() => import('streamsaver'), { ssr: false });

export default function SharedViewPage() {
  const { share_token } = useParams();
  const router = useRouter();
  const { token, isLoggedIn, hydrated } = useAppContext();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sharedFiles, setSharedFiles] = useState([]);
  const [sharedFolders, setSharedFolders] = useState([]);
  const [currentFolderId, setCurrentFolderId] = useState(null);
  const [currentFolderName, setCurrentFolderName] = useState('');
  const [navStack, setNavStack] = useState([]); // stack of {id,name}

  // Rename state
  const [renameTarget, setRenameTarget] = useState(null);

  useEffect(() => {
    if (!hydrated) return;
    if (!token || !isLoggedIn) {
      router.push('/login');
      return;
    }

    const init = async () => {
      try {
        setLoading(true);
        setError(null);

        // 1) Resolve token to shared item
        const res = await axios.get(
          `http://127.0.0.1:8000/shares/get_shares?token=${encodeURIComponent(share_token)}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        const { files = [], folders = [] } = res.data || {};
        setSharedFiles(files);
        setSharedFolders(folders);

        // If it's a folder share, load its children for display
        if (folders.length > 0) {
          const folder = folders[0];
          setCurrentFolderId(folder.folder_id);
          setCurrentFolderName(folder.folder_name);

          const children = await axios.get(
            `http://127.0.0.1:8000/folders/get_all_children/${folder.folder_id}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          setSharedFiles(children.data.files || []);
          setSharedFolders(children.data.folders || []);
        } else {
          setCurrentFolderId(null);
          setCurrentFolderName('');
        }
      } catch (e) {
        setError(e.response?.data?.detail || 'Invalid or expired share token, or insufficient permissions');
      } finally {
        setLoading(false);
      }
    };

  const crumbs = (() => {
    const base = [...navStack];
    if (currentFolderId && currentFolderName) {
      base.push({ id: currentFolderId, name: currentFolderName });
    }
    return base;
  })();

  const navigateToCrumb = async (index) => {
    const localCrumbs = (() => {
      const base = [...navStack];
      if (currentFolderId && currentFolderName) base.push({ id: currentFolderId, name: currentFolderName });
      return base;
    })();
    if (index < 0 || index >= localCrumbs.length) return;
    const target = localCrumbs[index];
    try {
      const newStack = localCrumbs.slice(0, index); // ancestors before target
      setNavStack(newStack);
      setCurrentFolderId(target.id);
      setCurrentFolderName(target.name);
      const children = await axios.get(
        `http://127.0.0.1:8000/folders/get_all_children/${target.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSharedFiles(children.data.files || []);
      setSharedFolders(children.data.folders || []);
    } catch (e) {
      alert(e.response?.data?.detail || 'Unable to navigate');
    }
  };

    init();
  }, [hydrated, token, isLoggedIn, router, share_token]);

  const openFolder = async (folder) => {
    try {
      // push current context to stack if exists
      if (currentFolderId) {
        setNavStack(prev => [...prev, { id: currentFolderId, name: currentFolderName }]);
      }
      setCurrentFolderId(folder.folder_id);
      setCurrentFolderName(folder.folder_name);
      const children = await axios.get(
        `http://127.0.0.1:8000/folders/get_all_children/${folder.folder_id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSharedFiles(children.data.files || []);
      setSharedFolders(children.data.folders || []);
    } catch (e) {
      alert(e.response?.data?.detail || 'Unable to open folder');
    }
  };

  const goBack = async () => {
    const prev = navStack[navStack.length - 1];
    if (!prev) return;
    const newStack = navStack.slice(0, -1);
    setNavStack(newStack);
    try {
      setCurrentFolderId(prev.id);
      setCurrentFolderName(prev.name);
      const children = await axios.get(
        `http://127.0.0.1:8000/folders/get_all_children/${prev.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSharedFiles(children.data.files || []);
      setSharedFolders(children.data.folders || []);
    } catch (e) {
      alert(e.response?.data?.detail || 'Unable to navigate back');
    }
  };

  const handleDownloadFile = async (file_id, file_name) => {
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

  const handleDownloadFolder = async (folderId, folderName = 'folder.zip') => {
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

  const handleRenameFile = async (fileId, newName) => {
    try {
      const formData = new FormData();
      formData.append('file_id', fileId);
      formData.append('file_name', newName);
      const result = await axios.put('http://127.0.0.1:8000/files/rename_file', formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (result.status === 200) {
        setSharedFiles(prev => prev.map(f => (f.file_id === fileId ? { ...f, file_name: newName } : f)));
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to rename file');
    }
  };

  const handleRenameFolder = async (folderId, newName, parent_id) => {
    try {
      const formData = new FormData();
      formData.append('folder_id', folderId);
      formData.append('folder_name', newName);
      formData.append('parent_id', parent_id ?? 0);
      const result = await axios.put('http://127.0.0.1:8000/folders/folder_rename', formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (result.status === 200) {
        setSharedFolders(prev => prev.map(f => (f.folder_id === folderId ? { ...f, folder_name: newName } : f)));
      }
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to rename folder');
    }
  };

  const handleDelete = async (folderIds = [], fileIds = []) => {
    try {
      const formData = new FormData();
      folderIds.forEach(id => formData.append('folder_ids', id));
      fileIds.forEach(id => formData.append('file_ids', id));
      const res = await axios.post('http://127.0.0.1:8000/folders/bulk_delete', formData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      const backendFiles = res.data?.files ?? [];
      const backendFolders = res.data?.folders ?? [];
      const deletedFiles = (Array.isArray(backendFiles) ? backendFiles : []).map(n => Number(n));
      const deletedFolders = (Array.isArray(backendFolders) ? backendFolders : []).map(n => Number(n));

      const filesToRemove = fileIds.filter(id => deletedFiles.includes(Number(id)));
      const foldersToRemove = folderIds.filter(id => deletedFolders.includes(Number(id)));

      if (filesToRemove.length === 0 && foldersToRemove.length === 0) {
        alert('Delete not successful for the selected items. You may not have edit permission.');
        return;
      }

      if (filesToRemove.length) {
        setSharedFiles(prev => prev.filter(f => !filesToRemove.includes(f.file_id)));
      }
      if (foldersToRemove.length) {
        setSharedFolders(prev => prev.filter(f => !foldersToRemove.includes(f.folder_id)));
      }
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to delete');
    }
  };

  const handleRenameSubmit = () => {
    if (!renameTarget) return;
    if (renameTarget.type === 'file') {
      handleRenameFile(renameTarget.id, renameTarget.name);
    } else if (renameTarget.type === 'folder') {
      handleRenameFolder(renameTarget.id, renameTarget.name, renameTarget.parent_id);
    }
    setRenameTarget(null);
  };

  if (!isLoggedIn || !hydrated) return null;

  // Compute breadcrumbs close to render to avoid scope/timing issues
  const shareCrumbs = (() => {
    const base = [...navStack];
    if (currentFolderId && currentFolderName) {
      base.push({ id: currentFolderId, name: currentFolderName });
    }
    return base;
  })();

  // Local handler to navigate to a breadcrumb index
  const onCrumbClick = async (index) => {
    if (index < 0 || index >= shareCrumbs.length) return;
    // Do nothing if clicking the last (current) crumb
    if (index === shareCrumbs.length - 1) return;
    const target = shareCrumbs[index];
    try {
      const newStack = shareCrumbs.slice(0, index);
      setNavStack(newStack);
      setCurrentFolderId(target.id);
      setCurrentFolderName(target.name);
      const children = await axios.get(
        `http://127.0.0.1:8000/folders/get_all_children/${target.id}`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSharedFiles(children.data.files || []);
      setSharedFolders(children.data.folders || []);
    } catch (e) {
      alert(e.response?.data?.detail || 'Unable to navigate');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
            <Share2 className="w-5 h-5" />
            Shared View
          </h1>
          {currentFolderId && (
            <div className="text-gray-600">Folder: <span className="font-medium">{currentFolderName}</span></div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentFolderId && (
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-gray-700">
              {shareCrumbs.map((c, idx) => (
                <span key={`${c.id}-${idx}`} className="flex items-center gap-2">
                  <button
                    type="button"
                    className={`hover:underline ${idx === shareCrumbs.length - 1 ? 'font-semibold text-gray-900 hover:no-underline' : ''}`}
                    onClick={() => onCrumbClick(idx)}
                  >
                    {c.name}
                  </button>
                  {idx < shareCrumbs.length - 1 && <span className="text-gray-400">/</span>}
                </span>
              ))}
            </div>
            <button onClick={goBack} disabled={navStack.length === 0} className={`px-3 py-1 text-sm border rounded ${navStack.length === 0 ? 'opacity-50 cursor-not-allowed' : 'hover:bg-gray-50'}`}>
              Back
            </button>
          </div>
        )}
        {loading && <div className="text-gray-600">Loading...</div>}
        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">{error}</div>
        )}

        {!loading && !error && (
          <>
            {/* Folders */}
            {sharedFolders.length > 0 && (
              <div className="mb-6">
                <h2 className="text-sm font-semibold text-gray-700 mb-2">Folders</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {sharedFolders.map(folder => (
                    <div key={folder.folder_id} className="group bg-white rounded-lg shadow-sm border border-gray-200 p-4 cursor-pointer" onClick={() => openFolder(folder)}>
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 rounded-lg">
                          <Folder className="w-6 h-6 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 truncate" title={folder.folder_name}>{folder.folder_name}</div>
                          <div className="text-xs text-gray-500">Folder</div>
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={(e) => { e.stopPropagation(); setRenameTarget({ type: 'folder', id: folder.folder_id, name: folder.folder_name, parent_id: folder.parent_id }); }}
                          className="px-2 py-1 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Rename"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDownloadFolder(folder.folder_id, `${folder.folder_name}.zip`); }}
                          className="px-2 py-1 text-sm text-gray-600 hover:text-green-600 hover:bg-green-50 rounded"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete([folder.folder_id], []); }}
                          className="px-2 py-1 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Files */}
            {sharedFiles.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-gray-700 mb-2">Files</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                  {sharedFiles.map(file => (
                    <div key={file.file_id} className="group bg-white rounded-lg shadow-sm border border-gray-200 p-4">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-green-100 rounded-lg">
                          <File className="w-6 h-6 text-green-600" />
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-gray-900 truncate" title={file.file_name}>{file.file_name}</div>
                          <div className="text-xs text-gray-500">File</div>
                        </div>
                      </div>
                      <div className="mt-3 flex gap-2">
                        <button
                          onClick={() => setRenameTarget({ type: 'file', id: file.file_id, name: file.file_name })}
                          className="px-2 py-1 text-sm text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="Rename"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDownloadFile(file.file_id, file.file_name)}
                          className="px-2 py-1 text-sm text-gray-600 hover:text-green-600 hover:bg-green-50 rounded"
                          title="Download"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete([], [file.file_id])}
                          className="px-2 py-1 text-sm text-gray-600 hover:text-red-600 hover:bg-red-50 rounded"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {sharedFiles.length === 0 && sharedFolders.length === 0 && (
              <div className="text-center text-gray-600">No content available for this share.</div>
            )}
          </>
        )}
      </div>

      {/* Rename Popup */}
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
              <button className="px-4 py-2 bg-gray-200 rounded" onClick={() => setRenameTarget(null)}>Cancel</button>
              <button className="px-4 py-2 bg-primary text-white rounded" onClick={handleRenameSubmit}>Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
