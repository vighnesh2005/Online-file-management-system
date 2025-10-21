"use client"

import { useState } from "react"
import { 
  Grid3x3, 
  List, 
  File, 
  Folder, 
  FileText, 
  Image as ImageIcon,
  Video,
  Music,
  Archive,
  MoreVertical
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const FileGrid = ({ files = [], onFileClick }) => {
  const [viewMode, setViewMode] = useState("grid") // "grid" or "list"

  const getFileIcon = (type) => {
    const iconProps = { className: "h-8 w-8", strokeWidth: 1.5 }
    
    if (type === "folder") return <Folder {...iconProps} />
    if (type?.includes("image")) return <ImageIcon {...iconProps} />
    if (type?.includes("video")) return <Video {...iconProps} />
    if (type?.includes("audio")) return <Music {...iconProps} />
    if (type?.includes("zip") || type?.includes("rar")) return <Archive {...iconProps} />
    if (type?.includes("text") || type?.includes("document")) return <FileText {...iconProps} />
    return <File {...iconProps} />
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return "—"
    const kb = bytes / 1024
    const mb = kb / 1024
    if (mb >= 1) return `${mb.toFixed(1)} MB`
    if (kb >= 1) return `${kb.toFixed(1)} KB`
    return `${bytes} B`
  }

  const formatDate = (date) => {
    if (!date) return "—"
    return new Date(date).toLocaleDateString("en-US", { 
      month: "short", 
      day: "numeric", 
      year: "numeric" 
    })
  }

  // Empty state
  if (!files || files.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
        <Folder className="h-24 w-24 mb-4 text-muted-foreground" strokeWidth={1} />
        <h3 className="text-lg font-medium mb-2">No files yet</h3>
        <p className="text-sm text-muted-foreground">Upload files to get started</p>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      {/* View Toggle */}
      <div className="flex items-center justify-between p-6 border-b border-border">
        <h2 className="text-lg font-medium">Files</h2>
        <div className="flex gap-1 border border-border">
          <button
            onClick={() => setViewMode("grid")}
            className={cn(
              "p-2 transition-fast",
              viewMode === "grid" 
                ? "bg-black text-white dark:bg-white dark:text-black" 
                : "hover:bg-gray-100 dark:hover:bg-gray-800"
            )}
          >
            <Grid3x3 className="h-4 w-4" strokeWidth={1.5} />
          </button>
          <button
            onClick={() => setViewMode("list")}
            className={cn(
              "p-2 transition-fast",
              viewMode === "list" 
                ? "bg-black text-white dark:bg-white dark:text-black" 
                : "hover:bg-gray-100 dark:hover:bg-gray-800"
            )}
          >
            <List className="h-4 w-4" strokeWidth={1.5} />
          </button>
        </div>
      </div>

      {/* Files Display */}
      {viewMode === "grid" ? (
        <div className="p-6 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {files.map((file) => (
            <div
              key={file.id}
              onClick={() => onFileClick?.(file)}
              className="border border-border bg-white dark:bg-black p-4 hover:bg-gray-100 dark:hover:bg-gray-800 transition-fast cursor-pointer group"
            >
              <div className="flex items-start justify-between mb-3">
                {getFileIcon(file.type)}
                <button className="opacity-0 group-hover:opacity-100 transition-fast">
                  <MoreVertical className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </div>
              <h3 className="text-sm font-normal truncate mb-1">{file.name}</h3>
              <p className="text-xs text-muted-foreground">
                {file.type === "folder" ? `${file.itemCount || 0} items` : formatFileSize(file.size)}
              </p>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex-1">
          {/* List Header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-border text-xs font-medium text-muted-foreground">
            <div className="col-span-6">Name</div>
            <div className="col-span-2">Owner</div>
            <div className="col-span-2">Modified</div>
            <div className="col-span-2">Size</div>
          </div>
          
          {/* List Items */}
          <div className="divide-y divide-border">
            {files.map((file) => (
              <div
                key={file.id}
                onClick={() => onFileClick?.(file)}
                className="grid grid-cols-12 gap-4 px-6 py-4 hover:bg-gray-100 dark:hover:bg-gray-800 transition-fast cursor-pointer group"
              >
                <div className="col-span-6 flex items-center gap-3">
                  {getFileIcon(file.type)}
                  <span className="text-sm truncate">{file.name}</span>
                </div>
                <div className="col-span-2 flex items-center text-sm text-muted-foreground">
                  {file.owner || "Me"}
                </div>
                <div className="col-span-2 flex items-center text-sm text-muted-foreground">
                  {formatDate(file.modified)}
                </div>
                <div className="col-span-2 flex items-center justify-between text-sm text-muted-foreground">
                  <span>{file.type === "folder" ? "—" : formatFileSize(file.size)}</span>
                  <button className="opacity-0 group-hover:opacity-100 transition-fast">
                    <MoreVertical className="h-4 w-4" strokeWidth={1.5} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default FileGrid
