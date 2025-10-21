"use client"

import { useState, useRef } from "react"
import { Upload, X, File, CheckCircle } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const UploadModal = ({ open, onOpenChange, onUpload }) => {
  const [files, setFiles] = useState([])
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)

  const handleFileSelect = (selectedFiles) => {
    const fileArray = Array.from(selectedFiles)
    setFiles(prev => [...prev, ...fileArray])
  }

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    if (e.dataTransfer.files) {
      handleFileSelect(e.dataTransfer.files)
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => {
    setIsDragging(false)
  }

  const removeFile = (index) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const handleUpload = () => {
    if (files.length > 0) {
      onUpload?.(files)
      setFiles([])
      onOpenChange(false)
    }
  }

  const formatFileSize = (bytes) => {
    const kb = bytes / 1024
    const mb = kb / 1024
    if (mb >= 1) return `${mb.toFixed(1)} MB`
    if (kb >= 1) return `${kb.toFixed(1)} KB`
    return `${bytes} B`
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-2xl"
        onClose={() => onOpenChange(false)}
      >
        <DialogHeader>
          <DialogTitle>Upload Files</DialogTitle>
          <DialogDescription>
            Drag and drop files here or click to browse
          </DialogDescription>
        </DialogHeader>

        {/* Drop Zone */}
        <div
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            "border-2 border-dashed p-12 text-center cursor-pointer transition-fast",
            isDragging 
              ? "border-black dark:border-white bg-gray-100 dark:bg-gray-800" 
              : "border-gray-300 dark:border-gray-700 hover:border-black dark:hover:border-white"
          )}
        >
          <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" strokeWidth={1.5} />
          <p className="text-sm font-medium mb-1">
            {isDragging ? "Drop files here" : "Click to upload or drag and drop"}
          </p>
          <p className="text-xs text-muted-foreground">
            Any file type supported
          </p>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={(e) => handleFileSelect(e.target.files)}
          className="hidden"
        />

        {/* File List */}
        {files.length > 0 && (
          <div className="mt-4 space-y-2 max-h-64 overflow-y-auto">
            {files.map((file, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3 border border-border bg-gray-50 dark:bg-gray-900"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <File className="h-5 w-5 flex-shrink-0" strokeWidth={1.5} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-normal truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                  </div>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    removeFile(index)
                  }}
                  className="ml-2 p-1 hover:bg-gray-200 dark:hover:bg-gray-800 transition-fast"
                >
                  <X className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 mt-6">
          <Button
            variant="outline"
            onClick={() => {
              setFiles([])
              onOpenChange(false)
            }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={files.length === 0}
            className="gap-2"
          >
            <Upload className="h-4 w-4" strokeWidth={1.5} />
            Upload {files.length > 0 && `(${files.length})`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default UploadModal
