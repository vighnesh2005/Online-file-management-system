'use client';
import { useAppContext } from "@/context/context";
import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import axios from "axios";
import { Download, UserPlus, Pencil, Share2, Settings, Plus, Trash2, Move, Search, Grid, List, Recycle, RefreshCw } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import dynamic from "next/dynamic";
import ShareModal from "@/components/ShareModal";
import TokenSearch from "@/components/TokenSearch";
import ShareManageModal from "@/components/ShareManageModal";
const streamSaver = dynamic(() => import("streamsaver"), { ssr: false });

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
  // Cached children for local fallback filtering when server search is unavailable
  const [baseFiles, setBaseFiles] = useState([]);
  const [baseFolders, setBaseFolders] = useState([]);
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

  // Share states
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareTarget, setShareTarget] = useState(null);
  const [showManageModal, setShowManageModal] = useState(false);
  const [manageTarget, setManageTarget] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState("");
  const [viewMode, setViewMode] = useState("grid"); // grid or list
  const [showTokenSearch, setShowTokenSearch] = useState(false);
  const [replacingId, setReplacingId] = useState(null);

  // Immediate search runner (used on Enter)
  const runSearchNow = async () => {
    if (!hydrated || !token || !isLoggedIn) return;
    try {
      setSearchError("");
      setSearchLoading(true);
      if (!searchQuery.trim()) {
        const fileRes = await axios.get(
          `http://127.0.0.1:8000/folders/get_all_children/${folder_id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        const filesArr = fileRes.data.files || [];
        const foldersArr = fileRes.data.folders || [];
        setFilesLocal(filesArr);
        setFoldersLocal(foldersArr);
        setBaseFiles(filesArr);
        setBaseFolders(foldersArr);
        return;
      }
      const res = await axios.get("http://127.0.0.1:8000/search/items", {
        headers: { Authorization: `Bearer ${token}` },
        params: { q: searchQuery.trim() },
      });
      setFilesLocal(res.data?.files || []);
      setFoldersLocal(res.data?.folders || []);
    } catch (e) {
      console.log(e);
      setSearchError(e?.response?.data?.detail || "Search failed – showing local results");
      const q = searchQuery.trim().toLowerCase();
      const ff = baseFiles.filter(f => (f.file_name || "").toLowerCase().includes(q));
      const fld = baseFolders.filter(f => (f.folder_name || "").toLowerCase().includes(q));
      setFilesLocal(ff);
      setFoldersLocal(fld);
    } finally {
      setSearchLoading(false);
    }
  };

  // Dynamic server-side search within current folder (debounced)
  useEffect(() => {
    if (!hydrated || !token || !isLoggedIn) return;

    const handler = setTimeout(async () => {
      try {
        setSearchError("");
        setSearchLoading(true);
        if (!searchQuery.trim()) {
          // Reload normal folder children when search is cleared
          const fileRes = await axios.get(
            `http://127.0.0.1:8000/folders/get_all_children/${folder_id}`,
            { headers: { Authorization: `Bearer ${token}` } }
          );
          const filesArr = fileRes.data.files || [];
          const foldersArr = fileRes.data.folders || [];
          setFilesLocal(filesArr);
          setFoldersLocal(foldersArr);
          setBaseFiles(filesArr);
          setBaseFolders(foldersArr);
          return;
        }

        // Query backend search scoped to this folder
        const res = await axios.get("http://127.0.0.1:8000/search/items", {
          headers: { Authorization: `Bearer ${token}` },
          params: { q: searchQuery.trim() },
        });
        setFilesLocal(res.data?.files || []);
        setFoldersLocal(res.data?.folders || []);
      } catch (e) {
        console.log(e);
        setSearchError(e?.response?.data?.detail || "Search failed – showing local results");
        // Fallback: do client-side filtering over cached children
        const q = searchQuery.trim().toLowerCase();
        const ff = baseFiles.filter(f => (f.file_name || "").toLowerCase().includes(q));
        const fld = baseFolders.filter(f => (f.folder_name || "").toLowerCase().includes(q));
        setFilesLocal(ff);
        setFoldersLocal(fld);
      } finally {
        setSearchLoading(false);
      }
    }, 350);

    return () => clearTimeout(handler);
  }, [searchQuery, folder_id, hydrated, token, isLoggedIn]);

  // Breadcrumbs
  const [breadcrumbs, setBreadcrumbs] = useState([]); // [{id, name}]

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

        const initFiles = fileRes.data.files || [];
        const initFolders = fileRes.data.folders || [];
        setFilesLocal(initFiles);
        setFoldersLocal(initFolders);
        setBaseFiles(initFiles);
        setBaseFolders(initFolders);

        // Build breadcrumbs up to root
        const buildCrumbs = async (id) => {
          const chain = [];
          let current = Number(id);
          if (Number.isNaN(current)) return [];
          while (current && current !== 0) {
            try {
              const detail = await axios.get("http://127.0.0.1:8000/folders/get_folder_details", {
                headers: { Authorization: `Bearer ${token}` },
                params: { folder_id: current },
              });
              const f = detail.data?.folder;
              if (!f) break;
              chain.unshift({ id: f.folder_id, name: f.folder_name });
              current = f.parent_id;
            } catch (e) {
              break;
            }
          }
          // Prepend root
          chain.unshift({ id: 0, name: "My Drive" });
          return chain;
        };

  // ===== Replace File =====
  const handleReplace = async (fileId, fileObj) => {
    if (!fileObj) return;
    try {
      setReplacingId(fileId);
      const form = new FormData();
      form.append('file_id', fileId);
      form.append('file', fileObj);
      const res = await axios.put('http://127.0.0.1:8000/files/replace_file', form, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const updated = res.data?.file;
      if (updated) {
        setFilesLocal(prev => prev.map(f => (f.file_id === fileId ? updated : f)));
      } else {
        // fallback refresh
        const fileRes = await axios.get(
          `http://127.0.0.1:8000/folders/get_all_children/${folder_id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setFilesLocal(fileRes.data.files || []);
        setFoldersLocal(fileRes.data.folders || []);
      }
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to replace file');
    } finally {
      setReplacingId(null);
    }
  };

        const crumbs = await buildCrumbs(folder_id);
        setBreadcrumbs(crumbs);
      } catch (err) {
        console.error(err);
        localStorage.clear();
        router.push("/login");
      }
    };

    fetchData();
  }, [hydrated, token, isLoggedIn, folder_id, router, setUser]);

  // ===== Replace File (component scope) =====
  const handleReplace = async (fileId, fileObj) => {
    if (!fileObj) return;
    try {
      setReplacingId(fileId);
      const form = new FormData();
      form.append('file_id', fileId);
      form.append('file', fileObj);
      const res = await axios.put('http://127.0.0.1:8000/files/replace_file', form, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const updated = res.data?.file;
      if (updated) {
        setFilesLocal(prev => prev.map(f => (f.file_id === fileId ? updated : f)));
      } else {
        // fallback refresh
        const fileRes = await axios.get(
          `http://127.0.0.1:8000/folders/get_all_children/${folder_id}`,
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setFilesLocal(fileRes.data.files || []);
        setFoldersLocal(fileRes.data.folders || []);
      }
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to replace file');
    } finally {
      setReplacingId(null);
    }
  };

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

      // Dynamically import streamsaver on client
      const streamSaver = (await import("streamsaver")).default;

      // Now this works
      const fileStream = streamSaver.createWriteStream(file_name);
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

      // Dynamically import StreamSaver on the client
      const streamSaver = (await import("streamsaver")).default;

      // Stream response to disk
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

      console.log("Folder download completed!");
    } catch (err) {
      console.error("Folder download failed:", err);
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
        // Store selected items in context for move mode
        setFiles(selectedFiles);
        setFolders(selectedFolders);
        setMoveMode(true);
        setEditMode(false);
        setModeType(null);
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
    try {
      const formData = new FormData();

      // Use the items from context that were selected for moving
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

      // Reset move mode
      setMoveMode(false);
      setFiles([]);
      setFolders([]);
    } catch (error) {
      console.error("Move error:", error);
      alert("Failed to move items. Please try again.");
    }
  }

  // Cancel move mode
  const cancelMove = () => {
    setMoveMode(false);
    setFiles([]);
    setFolders([]);
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

  // Share functions
  const handleShare = (item) => {
    setShareTarget({
      id: item.file_id || item.folder_id,
      name: item.file_name || item.folder_name,
      type: item.file_id ? 'file' : 'folder'
    });
    setShowShareModal(true);
  };

  const handleShareManagement = (item) => {
    setManageTarget({
      id: item.file_id || item.folder_id,
      name: item.file_name || item.folder_name,
      type: item.file_id ? 'file' : 'folder'
    });
    setShowManageModal(true);
  };


  // Filter items based on search
  // Server-driven results (no extra client filtering)
  const filteredFiles = filesLocal;
  const filteredFolders = foldersLocal;

  // ===== Render =====
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              {/* Breadcrumbs */}
              <nav className="flex items-center gap-2 text-lg text-gray-700">
                {breadcrumbs.map((c, idx) => (
                  <span key={c.id} className="flex items-center gap-2">
                    <button
                      className={`hover:underline ${idx === breadcrumbs.length - 1 ? 'font-semibold text-gray-900 hover:no-underline' : ''}`}
                      onClick={() => {
                        if (idx === breadcrumbs.length - 1) return;
                        router.push(`/folder/${c.id}`);
                      }}
                    >
                      {c.name}
                    </button>
                    {idx < breadcrumbs.length - 1 && <span className="text-gray-400">/</span>}
                  </span>
                ))}
              </nav>
              {moveMode && (
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm font-medium">
                    Move Mode
                  </span>
                  <div className="text-sm text-gray-600">
                    Moving {folders.length + files.length} item(s)
                  </div>
                </div>
              )}
            </div>
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search files and folders..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      runSearchNow();
                    }
                  }}
                  className="pl-10 pr-10 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-64"
                />
                {searchLoading && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                )}
              </div>

              {/* Token Search Button */}
              <button
                onClick={() => setShowTokenSearch(true)}
                className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
              >
                <Search className="w-4 h-4" />
                Search Token
              </button>

              {/* Recycle Bin Button */}
              <Link href="/recyclebin">
                <button className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
                  <Recycle className="w-4 h-4" />
                  Recycle Bin
                </button>
              </Link>

              {/* Logs Button */}
              <Link href="/logs">
                <button className="flex items-center gap-2 px-4 py-2 bg-gray-800 text-white rounded-lg hover:bg-gray-900 transition-colors">
                  <List className="w-4 h-4" />
                  Logs
                </button>
              </Link>

              {/* View Mode Toggle */}
              <div className="flex border border-gray-300 rounded-lg">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2 ${viewMode === "grid" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-2 ${viewMode === "list" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Action Bar */}
      <div className="bg-white border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {!moveMode ? (
                <>
                  <button
                    onClick={() => toggleMode('add_folder')}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    New Folder
                  </button>
                  <button
                    onClick={() => toggleMode('add_file')}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Upload File
                  </button>
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    onClick={handleMove}
                    className="flex items-center gap-2 px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors font-medium"
                  >
                    <Move className="w-4 h-4" />
                    Move Here
                  </button>
                  <button
                    onClick={cancelMove}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3">
              {!moveMode && (
                <>
                  {editMode && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">
                        {selectedFiles.length + selectedFolders.length} selected
                      </span>
                      <button
                        onClick={() => toggleMode('delete')}
                        className="flex items-center gap-2 px-3 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                        Delete
                      </button>
                      <button
                        onClick={() => toggleMode('move')}
                        className="flex items-center gap-2 px-3 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                      >
                        <Move className="w-4 h-4" />
                        Move
                      </button>
                    </div>
                  )}

                  {!editMode && (
                    <button
                      onClick={() => setEditMode(true)}
                      className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                      Manage
                    </button>
                  )}

                  {editMode && (
                    <button
                      onClick={() => {
                        setEditMode(false);
                        setSelectedFiles([]);
                        setSelectedFolders([]);
                        setModeType(null);
                      }}
                      className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Move Mode Indicator */}
      {moveMode && (
        <div className="bg-orange-50 border-b border-orange-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 rounded-lg">
                <Move className="w-5 h-5 text-orange-600" />
              </div>
              <div>
                <h3 className="font-medium text-orange-900">Move Mode Active</h3>
                <p className="text-sm text-orange-700">
                  You are moving {folders.length + files.length} item(s). Navigate to the destination folder and click "Move Here".
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search Error Banner */}
      {searchError && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-3">
          <div className="p-3 border border-red-300 bg-red-50 text-red-700 text-sm">
            {searchError}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {/* Folders Grid */}
            {filteredFolders.map(folder => (
              <div key={folder.folder_id} className="group bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-black transition-shadow">
                <div className="p-4">
                  {editMode && (
                    <div className="mb-2">
                      <input
                        type="checkbox"
                        checked={selectedFolders.includes(folder.folder_id)}
                        onChange={e => {
                          if (e.target.checked)
                            setSelectedFolders([...selectedFolders, folder.folder_id]);
                          else
                            setSelectedFolders(selectedFolders.filter(id => id !== folder.folder_id));
                        }}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                    </div>
                  )}

                  <div className="flex flex-col items-center text-center ">
                    <div className="p-3 bg-blue-100 rounded-lg mb-3 group-hover:bg-blue-200 transition-colors">
                      <Image src="/folder.svg" alt="Folder" width={32} height={32} />
                    </div>
                    <h3 className="font-medium text-gray-900 text-sm truncate w-full" title={folder.folder_name}>
                      {folder.folder_name}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1 truncate">{searchQuery ? (folder.path || 'Folder') : 'Folder'}</p>
                  </div>

                  {!editMode && (
                    <div className="mt-4 flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setRenameTarget({
                          type: "folder",
                          id: folder.folder_id,
                          name: folder.folder_name,
                          parent_id: folder.parent_id,
                        })}
                        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Rename"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleFolderDownload(folder.folder_id, folder.folder_name + ".zip")}
                        className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </button>
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
                    </div>
                  )}
                </div>

                {!editMode && (
                  <Link href={`/folder/${folder.folder_id}`} className="block">
                    <div className="px-4 py-2 bg-gray-50 hover:bg-gray-100 rounded-b-lg transition-colors">
                      <p className="text-xs text-gray-600 text-center">Click to open</p>
                    </div>
                  </Link>
                )}
              </div>
            ))}

            {/* Files Grid */}
            {filteredFiles.map(file => (
              <div key={file.file_id} className="group bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-black transition-shadow">
                <div className="p-4">
                  {editMode && (
                    <div className="mb-2">
                      <input
                        type="checkbox"
                        checked={selectedFiles.includes(file.file_id)}
                        onChange={e => {
                          if (e.target.checked)
                            setSelectedFiles([...selectedFiles, file.file_id]);
                          else
                            setSelectedFiles(selectedFiles.filter(id => id !== file.file_id));
                        }}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                    </div>
                  )}

                  <div className="flex flex-col items-center text-center">
                    <div className="p-3 bg-green-100 rounded-lg mb-3 group-hover:bg-green-200 transition-colors">
                      <Image src="/file.svg" alt="File" width={32} height={32} />
                    </div>
                    <h3 className="font-medium text-gray-900 text-sm truncate w-full" title={file.file_name}>
                      {file.file_name}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1 truncate">{searchQuery ? (file.path || 'File') : 'File'}</p>
                  </div>

                  {!editMode && (
                    <div className="mt-4 flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setRenameTarget({ type: "file", id: file.file_id, name: file.file_name })}
                        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Rename"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <label className={`p-2 text-gray-600 border rounded-lg ${replacingId===file.file_id ? 'opacity-60' : 'hover:bg-gray-50'} cursor-pointer transition-colors`} title="Replace">
                        <input
                          type="file"
                          className="hidden"
                          onChange={(e)=>{ const f=e.target.files?.[0]; if(f){ handleReplace(file.file_id, f);} e.target.value=''; }}
                          disabled={replacingId===file.file_id}
                        />
                        <RefreshCw className="w-4 h-4" />
                      </label>
                      <button
                        onClick={() => handleDownload(file.file_id, file.file_name)}
                        className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </button>
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
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* List View */
          <div className="space-y-2">
            {/* Folders List */}
            {filteredFolders.map(folder => (
              <div key={folder.folder_id} className="group bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-black transition-shadow">
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    {editMode && (
                      <input
                        type="checkbox"
                        checked={selectedFolders.includes(folder.folder_id)}
                        onChange={e => {
                          if (e.target.checked)
                            setSelectedFolders([...selectedFolders, folder.folder_id]);
                          else
                            setSelectedFolders(selectedFolders.filter(id => id !== folder.folder_id));
                        }}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                    )}
                    <div className="p-2 bg-blue-100 rounded-lg">
                      <Image src="/folder.svg" alt="Folder" width={24} height={24} />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{folder.folder_name}</h3>
                      <p className="text-sm text-gray-500 truncate">{searchQuery ? (folder.path || 'Folder') : 'Folder'}</p>
                    </div>
                  </div>

                  {!editMode && (
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setRenameTarget({
                          type: "folder",
                          id: folder.folder_id,
                          name: folder.folder_name,
                          parent_id: folder.parent_id,
                        })}
                        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Rename"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleFolderDownload(folder.folder_id, folder.folder_name + ".zip")}
                        className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </button>
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
                      <Link href={`/folder/${folder.folder_id}`}>
                        <button className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                          <Image src="/folder.svg" alt="Open" width={16} height={16} />
                        </button>
                      </Link>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Files List */}
            {filteredFiles.map(file => (
              <div key={file.file_id} className="group bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-black transition-shadow">
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    {editMode && (
                      <input
                        type="checkbox"
                        checked={selectedFiles.includes(file.file_id)}
                        onChange={e => {
                          if (e.target.checked)
                            setSelectedFiles([...selectedFiles, file.file_id]);
                          else
                            setSelectedFiles(selectedFiles.filter(id => id !== file.file_id));
                        }}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                    )}
                    <div className="p-2 bg-green-100 rounded-lg">
                      <Image src="/file.svg" alt="File" width={24} height={24} />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{file.file_name}</h3>
                      <p className="text-sm text-gray-500 truncate">{searchQuery ? (file.path || 'File') : 'File'}</p>
                    </div>
                  </div>

                  {!editMode && (
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setRenameTarget({ type: "file", id: file.file_id, name: file.file_name })}
                        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        title="Rename"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDownload(file.file_id, file.file_name)}
                        className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </button>
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
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {filteredFiles.length === 0 && filteredFolders.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Image src="/folder.svg" alt="Empty" width={32} height={32} />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchQuery ? 'No results found' : 'This folder is empty'}
            </h3>
            <p className="text-gray-500 mb-6">
              {searchQuery
                ? `No files or folders match "${searchQuery}"`
                : 'Upload files or create folders to get started'
              }
            </p>
            {!searchQuery && (
              <div className="flex justify-center gap-3">
                <button
                  onClick={() => toggleMode('add_folder')}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  New Folder
                </button>
                <button
                  onClick={() => toggleMode('add_file')}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Upload File
                </button>
              </div>
            )}
          </div>
        )}
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
      {/* Share Modals */}
      <ShareModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        item={shareTarget}
        token={token}
        onShareSuccess={() => {
          setShowShareModal(false);
          // Optionally refresh data or show success message
        }}
      />

      <ShareManageModal
        isOpen={showManageModal}
        onClose={() => setShowManageModal(false)}
        item={manageTarget}
        token={token}
      />

      <TokenSearch
        isOpen={showTokenSearch}
        onClose={() => setShowTokenSearch(false)}
        token={token}
      />
    </div>
  );
}
