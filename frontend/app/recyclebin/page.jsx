"use client";
import { useAppContext } from "@/context/context";
import { useEffect, useState } from "react";
import axios from "axios";
import {
  Download,
  Trash2,
  ArchiveRestore,
  Search,
  Grid,
  List,
  RotateCcw,
  X
} from "lucide-react";
import dynamic from "next/dynamic";
import Image from "next/image";
import DriveLayout from "@/components/common/DriveLayout";

const RecycleBin = () => {
  const [files, setFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [selectMode, setSelectMode] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("grid");

  const { token, hydrated } = useAppContext();

  useEffect(() => {
    if (hydrated) {
      const fetchData = async () => {
        const res = await axios.get("http://127.0.0.1:8000/recycle/recyclebin", {
          headers: { Authorization: `Bearer ${token}` },
        });
        setFiles(res.data.files);
      };
      fetchData();
    }
  }, [hydrated]);

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

    const streamSaver = (await import("streamsaver")).default;


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

    console.log("✅ Download completed!");
  } catch (err) {
    console.error("Download failed:", err);
    alert("Something went wrong while downloading the file");
  }
};


// ===== permanent delete =====
  const handleDelete = async (deleteFiles) => {
    try {
      const formData = new FormData();
      deleteFiles.forEach((id) => formData.append("file_ids", id));
      const res = await axios.post(
        "http://127.0.0.1:8000/recycle/permanent_delete",
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert(res.data.message);

      if (res.data.message === "Files permanently deleted successfully") {
        setFiles((prev) => prev.filter((f) => !deleteFiles.includes(f.file_id)));
        setSelectedFiles([]);
        setSelectMode(false);
      }
    } catch (error) {
      console.error("Delete error:", error);
      alert(error.detail || error.message || "Delete failed");
    }
  };

  const toggleFileSelection = (fileId) => {
    setSelectedFiles((prev) =>
      prev.includes(fileId)
        ? prev.filter((id) => id !== fileId)
        : [...prev, fileId]
    );
  };

  const handleMainButtonClick = () => {
    if (selectMode && selectedFiles.length > 0) {
      // delete selected files
      handleDelete(selectedFiles);
    } else if (selectMode && selectedFiles.length === 0) {
      // turn off selection mode
      setSelectMode(false);
    } else {
      // turn on selection mode
      setSelectMode(true);
    }
  };

  // ===== Restore Files =====
  const handleRestoreFiles = async (restoreFiles)=>{
    try {
      const formData = new FormData();
      restoreFiles.forEach((id) => formData.append("file_ids", id));
      const res = await axios.post(
        "http://127.0.0.1:8000/recycle/restore",
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      alert(res.data.message);

      if (res.data.message === "Files restored successfully") {
        setFiles((prev) => prev.filter((f) => !restoreFiles.includes(f.file_id)));
        setSelectedFiles([]);
        setSelectMode(false);
      }
    } catch (error) {
      console.error("Restore error:", error);
      alert(error.detail || error.message || "Restore failed");
    }
  }

  const handleRestoreButtonClick = () => {
  if (selectMode && selectedFiles.length > 0) {
    // restore selected files
    handleRestoreFiles(selectedFiles);
  } else if (selectMode && selectedFiles.length === 0) {
    // turn off selection mode
    setSelectMode(false);
  } else {
    // turn on selection mode
    setSelectMode(true);
  }
};

  // Filter files based on search
  const filteredFiles = files.filter(file => 
    file.file_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <DriveLayout>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2">Recycle Bin</h1>
          <p className="text-sm sm:text-base text-gray-600">Restore or permanently delete files</p>
        </div>

        {/* Action Bar */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3">
              {!selectMode ? (
                <button
                  onClick={() => setSelectMode(true)}
                  className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <RotateCcw className="w-4 h-4" />
                  Select Items
                </button>
              ) : (
                <>
                  <span className="text-sm text-gray-600">
                    {selectedFiles.length} selected
                  </span>
                  <button
                    onClick={() => handleRestoreFiles(selectedFiles)}
                    disabled={selectedFiles.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <ArchiveRestore className="w-4 h-4" />
                    Restore
                  </button>
                  <button
                    onClick={() => handleDelete(selectedFiles)}
                    disabled={selectedFiles.length === 0}
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Forever
                  </button>
                  <button
                    onClick={() => {
                      setSelectMode(false);
                      setSelectedFiles([]);
                    }}
                    className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    Cancel
                  </button>
                </>
              )}
            </div>
            
            <div className="flex items-center gap-3">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Search..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent w-48 sm:w-64"
                />
              </div>
              
              {/* View Mode Toggle */}
              <div className="flex border border-gray-300 rounded-lg">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2 ${viewMode === "grid" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
                  title="Grid view"
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-2 ${viewMode === "list" ? "bg-blue-600 text-white" : "text-gray-600 hover:bg-gray-50"}`}
                  title="List view"
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Content */}
        {viewMode === "grid" ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {filteredFiles.map(file => (
              <div key={file.file_id} className="hover:border-black  group bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                <div className="p-4">
                  {selectMode && (
                    <div className="mb-2">
                      <input
                        type="checkbox"
                        checked={selectedFiles.includes(file.file_id)}
                        onChange={() => toggleFileSelection(file.file_id)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                    </div>
                  )}
                  
                  <div className="flex flex-col items-center text-center">
                    <div className="p-3 bg-red-100 rounded-lg mb-3 group-hover:bg-red-200 transition-colors">
                      <Image src="/file.svg" alt="File" width={32} height={32} />
                    </div>
                    <h3 className="font-medium text-gray-900 text-sm truncate w-full" title={file.file_name}>
                      {file.file_name}
                    </h3>
                    <p className="text-xs text-gray-500 mt-1">Deleted File</p>
                  </div>
                  
                  {!selectMode && (
                    <div className="mt-4 flex justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleDownload(file.file_id, file.file_name)}
                        className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRestoreFiles([file.file_id])}
                        className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Restore"
                      >
                        <ArchiveRestore className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete([file.file_id])}
                        className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Forever"
                      >
                        <Trash2 className="w-4 h-4" />
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
            {filteredFiles.map(file => (
              <div key={file.file_id} className="group bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    {selectMode && (
                      <input
                        type="checkbox"
                        checked={selectedFiles.includes(file.file_id)}
                        onChange={() => toggleFileSelection(file.file_id)}
                        className="w-4 h-4 text-blue-600 rounded"
                      />
                    )}
                    <div className="p-2 bg-red-100 rounded-lg">
                      <Image src="/file.svg" alt="File" width={24} height={24} />
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-900">{file.file_name}</h3>
                      <p className="text-sm text-gray-500">Deleted File</p>
                    </div>
                  </div>
                  
                  {!selectMode && (
                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => handleDownload(file.file_id, file.file_name)}
                        className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Download"
                      >
                        <Download className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleRestoreFiles([file.file_id])}
                        className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                        title="Restore"
                      >
                        <ArchiveRestore className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete([file.file_id])}
                        className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        title="Delete Forever"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {filteredFiles.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-8 h-8 text-gray-400" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">
              {searchQuery ? 'No results found' : 'Recycle Bin is empty'}
            </h3>
            <p className="text-gray-500">
              {searchQuery 
                ? `No deleted files match "${searchQuery}"`
                : 'Deleted files will appear here'
              }
            </p>
          </div>
        )}
      </div>
    </DriveLayout>
  );
};

export default RecycleBin;
