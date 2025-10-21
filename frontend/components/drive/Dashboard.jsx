"use client"

import { useState } from "react"
import Sidebar from "./Sidebar"
import TopBar from "./TopBar"
import FileGrid from "./FileGrid"
import UploadModal from "./UploadModal"
import FilePreviewModal from "./FilePreviewModal"

const Dashboard = ({ initialFiles = [] }) => {
  const [uploadModalOpen, setUploadModalOpen] = useState(false)
  const [previewModalOpen, setPreviewModalOpen] = useState(false)
  const [selectedFile, setSelectedFile] = useState(null)
  const [files, setFiles] = useState(initialFiles)

  const handleUpload = (uploadedFiles) => {
    console.log("Uploading files:", uploadedFiles)
    // Here you would typically upload to your backend
    // For now, we'll just add them to the local state
    const newFiles = uploadedFiles.map((file, index) => ({
      id: Date.now() + index,
      name: file.name,
      type: file.type,
      size: file.size,
      modified: new Date().toISOString(),
      created: new Date().toISOString(),
      owner: "Me",
      location: "My Drive"
    }))
    setFiles(prev => [...newFiles, ...prev])
  }

  const handleFileClick = (file) => {
    setSelectedFile(file)
    setPreviewModalOpen(true)
  }

  const handleDownload = (file) => {
    console.log("Downloading file:", file)
    // Implement download logic
  }

  const handleDelete = (file) => {
    console.log("Deleting file:", file)
    setFiles(prev => prev.filter(f => f.id !== file.id))
  }

  const handleShare = (file) => {
    console.log("Sharing file:", file)
    // Implement share logic
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <TopBar onUploadClick={() => setUploadModalOpen(true)} />

        {/* File Grid */}
        <FileGrid files={files} onFileClick={handleFileClick} />
      </div>

      {/* Modals */}
      <UploadModal
        open={uploadModalOpen}
        onOpenChange={setUploadModalOpen}
        onUpload={handleUpload}
      />

      <FilePreviewModal
        open={previewModalOpen}
        onOpenChange={setPreviewModalOpen}
        file={selectedFile}
        onDownload={handleDownload}
        onDelete={handleDelete}
        onShare={handleShare}
      />
    </div>
  )
}

export default Dashboard
