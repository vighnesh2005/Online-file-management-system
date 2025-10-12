'use client';
import { useAppContext } from "@/context/context";
import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import axios from "axios";
import { Folder, File, Download, UserPlus, Pencil } from "lucide-react";
import Link from "next/link";
import streamSaver from "streamsaver";

export default function Home() {
  const {
    user,
    token,
    isLoggedIn,
    hydrated,
    setUser,
    files,
    setFiles,
    folders,
    setFolders,
    moveMode,
    setMoveMode,
    setIsLoggedIn
  } = useAppContext();
  const router = useRouter();
  const { folder_id } = useParams();

  const [filesLocal, setFilesLocal] = useState([]);
  const [foldersLocal, setFoldersLocal] = useState([]);
  const [renameTarget, setRenameTarget] = useState(null);

  // local selection state
  const [editMode, setEditMode] = useState(false);
  const [modeType, setModeType] = useState(null); // 'delete' or 'move'
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [selectedFolders, setSelectedFolders] = useState([]);

  // NEW STATES for create popups
  const [showCreateFolderPopup, setShowCreateFolderPopup] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [showCreateFilePopup, setShowCreateFilePopup] = useState(false);
  const [newFile, setNewFile] = useState(null);

  // ====== Load files/folders ======
  useEffect(() => {
    if (!hydrated) return;
    if (!token || !isLoggedIn) {
      router.push("/login");
      return;
    }

    const fetchData = async () => {
      try {
        const userRes = await axios.get("http://127.0.0.1:8000/auth/me", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setUser(userRes.data.user || userRes.data);

        const fileRes = await axios.get(
          `http://127.0.0.1:8000/folders/get_all_children/${folder_id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );

        setFilesLocal(fileRes.data.files || []);
        setFoldersLocal(fileRes.data.folders || []);
      } catch (err) {
        console.error(err);
        localStorage.clear();
        router.push("/login");
      }
    };

    fetchData();
  }, [hydrated, token, isLoggedIn, folder_id, router, setUser]);

  // ===== Rename =====
  const renameFile = async (fileId, rename) => {
    try {
      const formData = new FormData();
      formData.append("file_id", fileId);
      formData.append("file_name", rename);
      const result = await axios.put("http://127.0.0.1:8000/files/rename_file", formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (result.status === 200) {
        setFilesLocal(prev =>
          prev.map(f => (f.file_id === fileId ? { ...f, file_name: rename } : f))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const renameFolder = async (folderId, rename, parent_id) => {
    try {
      const formData = new FormData();
      formData.append("folder_id", folderId);
      formData.append("folder_name", rename);
      formData.append("parent_id", parent_id);
      const result = await axios.put("http://127.0.0.1:8000/folders/folder_rename", formData, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (result.status === 200) {
        setFoldersLocal(prev =>
          prev.map(f => (f.folder_id === folderId ? { ...f, folder_name: rename } : f))
        );
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRenameSubmit = () => {
    if (!renameTarget) return;
    if (renameTarget.type === "file") renameFile(renameTarget.id, renameTarget.name);
    if (renameTarget.type === "folder")
      renameFolder(renameTarget.id, renameTarget.name, renameTarget.parent_id);
    setRenameTarget(null);
  };

  // ===== File Download =====

const handleDownload = async (file_id, file_name) => {
  try {
    const token = localStorage.getItem("token");

    const res = await fetch(`http://127.0.0.1:8000/files/download_file/${file_id}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const error = await res.json();
      alert(error.detail || error.message || "Download failed");
      return;
    }

    // Stream to disk using StreamSaver
    const fileStream = streamSaver.createWriteStream(file_name);
    const readableStream = res.body;

    if (window.WritableStream && readableStream.pipeTo) {
      // Modern browsers
      await readableStream.pipeTo(fileStream);
    } else {
      // Fallback for older browsers
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

    console.log("Download completed!");
  } catch (err) {
    console.error("Download failed:", err);
    alert("Something went wrong while downloading the file");
  }
};


const handleFolderDownload = async (folderId, folderName = "folder.zip") => {
  try {
    const token = localStorage.getItem("token");

    const res = await fetch(`http://127.0.0.1:8000/folders/download_folder/${folderId}`, {
      method: "GET",
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!res.ok) {
      const error = await res.json();
      alert(error.detail || error.message || "Download failed");
      return;
    }

    // Stream response to disk using StreamSaver
    const fileStream = streamSaver.createWriteStream(folderName);
    const readableStream = res.body;

    if (window.WritableStream && readableStream.pipeTo) {
      await readableStream.pipeTo(fileStream);
    } else {
      // fallback for older browsers
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

    alert("Download completed!");
  } catch (err) {
    console.error(err);
    alert("Something went wrong while downloading the folder");
  }
};



  // ===== Mode Handling =====
  const toggleMode = (type) => {
    if (type === "add_folder") {
      setShowCreateFolderPopup(true);
      return;
    }
    if (type === "add_file") {
      setShowCreateFilePopup(true);
      return;
    }

    if (editMode && modeType === type) {
      if (type === "move") {
        setFiles(selectedFiles);
        setFolders(selectedFolders);
        setMoveMode(true);
        setEditMode(false);
      }
      if (type === "delete") handleDelete();

      setSelectedFiles([]);
      setSelectedFolders([]);
      setEditMode(false);
      setModeType(null);
    } else {
      setEditMode(true);
      setModeType(type);
    }
  };

  const handleDelete = async () => {
    console.log("Delete called on:", selectedFiles, selectedFolders);
    try {
      const formData = new FormData();
      selectedFolders.forEach(id => formData.append("folder_ids", id));
      selectedFiles.forEach(id => formData.append("file_ids", id));

      const res = await axios.post("http://127.0.0.1:8000/folders/bulk_delete", formData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data.message === "Folder deleted successfully") {
        setFilesLocal(prev => prev.filter(f => !selectedFiles.includes(f.file_id)));
        setFoldersLocal(prev => prev.filter(f => !selectedFolders.includes(f.folder_id)));
      }

      setSelectedFiles([]);
      setSelectedFolders([]);
    } catch (error) {
      console.error("Delete error:", error);
    }
  };

  // ====== Move ======
  const handleMove = async () => {
    const formData = new FormData();
    folders.forEach(id => formData.append("folder_ids", id));
    files.forEach(id => formData.append("file_ids", id));
    formData.append("parent_id", folder_id);

    const res = await axios.put("http://127.0.0.1:8000/folders/bulk_move", formData, {
      headers: { Authorization: `Bearer ${token}` },
    });
    alert(res.data.message);
    if (res.data.message === "moved successfully") {
      setFilesLocal(res.data.files);
      setFoldersLocal(res.data.folders);
    }
    setEditMode(false);
    setMoveMode(false);
    setFiles([])
    setFolders([])
  }

  // ====== CREATE Folder ======
  const handleCreateFolder = async () => {
    const formData = new FormData();
    formData.append("folder_name", newFolderName);
    formData.append("parent_id", folder_id);

    console.log("Creating folder:", newFolderName);
    const res = await axios.post("http://127.0.0.1:8000/folders/create_folder", 
      formData, { headers: { Authorization: `Bearer ${token}` } });
    alert(res.data.message);

    if (res.data.message === "Folder created successfully") {
      setFoldersLocal(prev => [...prev, res.data.folder]);
    }

    setShowCreateFolderPopup(false);
    setNewFolderName("");
  };
  // ===== CREATE File =====
  const handleCreateFile = async () => {
    console.log("Creating file:", newFile);
    const formData = new FormData();
    formData.append("file", newFile);
    formData.append("parent_id", folder_id);

    const res = await axios.post("http://127.0.0.1:8000/files/upload_file", formData, {
      headers: { Authorization: `Bearer ${token}` },
    })

    alert(res.data.message);

    if (res.data.message === "File uploaded successfully") {
      setFilesLocal(prev => [...prev, res.data.file]);
    }

    setShowCreateFilePopup(false);
    setNewFile(null);
  };

  // ===== Render =====
  return (
    <div className="min-h-screen bg-surface text-gray-800 p-8">
      <h1 className="text-3xl font-semibold mb-6 text-primary">
        My Drive
        <button className="ml-2 px-4 py-2 rounded bg-red-500 text-white text-lg" onClick={() => toggleMode('delete')}>Delete</button>
        {
          moveMode ? (
            <button className="ml-2 px-4 py-2 rounded bg-green-500 text-white text-lg" onClick={() => handleMove()}>Move Here</button>
          ) :
          modeType === 'move'?
          (
            <button className="ml-2 px-4 py-2 rounded bg-green-500 text-white text-lg" onClick={() => toggleMode('move')}>Confirm</button>
          ):
          (
            <button className="ml-2 px-4 py-2 rounded bg-green-500 text-white text-lg" onClick={() => toggleMode('move')}>Move</button>
          )
        }
        <button className="ml-2 px-4 py-2 rounded bg-blue-500 text-white text-lg" onClick={() => toggleMode('add_folder')}>Add Folder</button>
        <button className="ml-2 px-4 py-2 rounded bg-yellow-500 text-white text-lg" onClick={() => toggleMode('add_file')}>Add File</button>
      </h1>

      <div className="flex flex-col">
        {/* Folders */}
        {foldersLocal.map(folder => (
          <div key={folder.folder_id} className="bg-white shadow-md rounded-sm p-1 mb-2 border flex items-center justify-between">
            <div className="flex items-center">
              {editMode && modeType && (
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={selectedFolders.includes(folder.folder_id)}
                  onChange={e => {
                    if (e.target.checked)
                      setSelectedFolders([...selectedFolders, folder.folder_id]);
                    else
                      setSelectedFolders(selectedFolders.filter(id => id !== folder.folder_id));
                  }}
                />
              )}
              {!editMode ? (
                <Link href={`/folder/${folder.folder_id}`} className="flex items-center">
                  <Folder className="w-7 h-7 text-primary" />
                  <p className="text-sm font-medium mx-2">{folder.folder_name}</p>
                </Link>
              ) : (
                <div className="flex items-center">
                  <Folder className="w-7 h-7 text-primary" />
                  <p className="text-sm font-medium mx-2">{folder.folder_name}</p>
                </div>
              )}
            </div>
            {!editMode && (
              <div className="flex items-center gap-2">
                <Pencil
                  onClick={() =>
                    setRenameTarget({
                      type: "folder",
                      id: folder.folder_id,
                      name: folder.folder_name,
                      parent_id: folder.parent_id,
                    })
                  }
                />
                <Download 
                  onClick={() => handleFolderDownload(folder.folder_id,folder.folder_name+".zip")}
                />
                <UserPlus />
              </div>
            )}
          </div>
        ))}

        {/* Files */}
        {filesLocal.map(file => (
          <div key={file.file_id} className="bg-white shadow-md rounded-sm p-1 mb-2 border flex items-center justify-between">
            <div className="flex items-center">
              {editMode && modeType && (
                <input
                  type="checkbox"
                  className="mr-2"
                  checked={selectedFiles.includes(file.file_id)}
                  onChange={e => {
                    if (e.target.checked) setSelectedFiles([...selectedFiles, file.file_id]);
                    else setSelectedFiles(selectedFiles.filter(id => id !== file.file_id));
                  }}
                />
              )}
              <File className="w-7 h-7 text-accent" />
              <p className="text-sm font-medium mx-2">{file.file_name}</p>
            </div>
            {!editMode && (
              <div className="flex items-center gap-2">
                <Pencil onClick={() => setRenameTarget({ type: "file", id: file.file_id, name: file.file_name })} />
                <Download onClick={() => handleDownload(file.file_id, file.file_name)} />
                <UserPlus />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ===== Rename popup ===== */}
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

      {/* ===== Add Folder popup ===== */}
      {showCreateFolderPopup && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-md shadow-md w-80">
            <h2 className="text-lg font-semibold mb-4">Create New Folder</h2>
            <input
              type="text"
              placeholder="Folder name"
              value={newFolderName}
              onChange={e => setNewFolderName(e.target.value)}
              className="w-full p-2 border border-gray-300 rounded mb-4"
            />
            <div className="flex justify-end gap-2">
              <button className="px-4 py-2 bg-gray-200 rounded" onClick={() => setShowCreateFolderPopup(false)}>Cancel</button>
              <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={handleCreateFolder}>Create</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Add File popup ===== */}
      {showCreateFilePopup && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-md shadow-md w-80">
            <h2 className="text-lg font-semibold mb-4">Upload File</h2>
            <input
              type="file"
              accept="*"
              onChange={e => setNewFile(e.target.files[0])}
              className="w-full mb-4"
            />
            <div className="flex justify-end gap-2">
              <button className="px-4 py-2 bg-gray-200 rounded" onClick={() => setShowCreateFilePopup(false)}>Cancel</button>
              <button className="px-4 py-2 bg-yellow-500 text-white rounded" onClick={handleCreateFile}>Upload</button>
            </div>
          </div>
        </div>
      )}
      {
        filesLocal.length === 0 && foldersLocal.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-lg font-semibold text-gray-500">This folder is empty</p>
          </div>
        )
      }
    </div>
  );
}
