"use client";
import { useAppContext } from "@/context/context";
import { useEffect, useState } from "react";
import axios from "axios";
import {
  Folder,
  File,
  Download,
  Trash2,
  ArchiveRestore,
} from "lucide-react";
import dynamic from "next/dynamic";

const RecycleBin = () => {
  const [files, setFiles] = useState([]);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [selectMode, setSelectMode] = useState(false);

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

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-4">
  <h1 className="text-xl font-semibold">Recycle Bin</h1>
  
  <div className="flex gap-2">
    {/* Delete / Select Button */}
    <button
      className={`px-4 py-2 rounded text-white ${
        selectMode ? "bg-red-600 hover:bg-red-700" : "bg-gray-600 hover:bg-gray-700"
      }`}
      onClick={handleMainButtonClick}
    >
      {selectMode
        ? selectedFiles.length > 0
          ? "Delete Selected"
          : "Cancel"
        : "Select Files"}
    </button>

    {/* Restore Button */}
    <button
      className={`px-4 py-2 rounded text-white ${
        selectMode ? "bg-green-600 hover:bg-green-700" : "bg-gray-600 hover:bg-gray-700"
      }`}
      onClick={handleRestoreButtonClick}
    >
      {selectMode
        ? selectedFiles.length > 0
          ? "Restore Selected"
          : "Cancel"
        : "Restore Files"}
    </button>
  </div>
</div>

      <div>
        {files.map((file) => (
          <div
            key={file.file_id}
            className={`bg-white shadow-sm rounded-md p-3 mb-2 border flex items-center justify-between ${
              selectedFiles.includes(file.file_id)
                ? "border-red-400 bg-red-50"
                : ""
            }`}
          >
            <div className="flex items-center gap-3">
              {selectMode && (
                <input
                  type="checkbox"
                  checked={selectedFiles.includes(file.file_id)}
                  onChange={() => toggleFileSelection(file.file_id)}
                />
              )}
              <File className="w-6 h-6 text-gray-700" />
              <p className="text-sm font-medium">{file.file_name}</p>
            </div>

            <div className="flex gap-3 items-center">
              <Download className="w-6 h-6 text-gray-700 cursor-pointer" onClick={() => {handleDownload(file.file_id,file.file_name)}}/>
              {!selectMode && (
                <>
                  <Trash2
                    className="w-6 h-6 text-red-600 cursor-pointer"
                    onClick={() => handleDelete([file.file_id])}
                  />
                  <ArchiveRestore className="w-6 h-6 text-green-600 cursor-pointer"
                    onClick={() => {handleRestoreFiles([file.file_id])}}
                  />
                </>
              )}
            </div>
          </div>
        ))}

        {files.length === 0 && (
          <p className="text-gray-500 text-sm text-center mt-4">
            No files in Recycle Bin.
          </p>
        )}
      </div>
    </div>
  );
};

export default RecycleBin;
