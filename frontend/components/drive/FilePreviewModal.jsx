"use client"

import { Download, Trash2, Share2, X, File } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

const FilePreviewModal = ({ open, onOpenChange, file, onDownload, onDelete, onShare }) => {
  if (!file) return null

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
    return new Date(date).toLocaleString("en-US", { 
      month: "short", 
      day: "numeric", 
      year: "numeric",
      hour: "numeric",
      minute: "2-digit"
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="max-w-3xl"
        onClose={() => onOpenChange(false)}
      >
        <DialogHeader>
          <DialogTitle>{file.name}</DialogTitle>
        </DialogHeader>

        {/* File Preview Area */}
        <div className="border border-border bg-gray-50 dark:bg-gray-900 p-12 flex items-center justify-center min-h-[300px]">
          {file.type?.includes("image") ? (
            <img 
              src={file.url || "/placeholder.png"} 
              alt={file.name}
              className="max-w-full max-h-[400px] object-contain"
            />
          ) : (
            <div className="text-center">
              <File className="h-24 w-24 mx-auto mb-4 text-muted-foreground" strokeWidth={1} />
              <p className="text-sm text-muted-foreground">Preview not available</p>
            </div>
          )}
        </div>

        {/* File Info */}
        <div className="grid grid-cols-2 gap-4 py-4 border-t border-border">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Type</p>
            <p className="text-sm font-normal">{file.type || "Unknown"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Size</p>
            <p className="text-sm font-normal">{formatFileSize(file.size)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Owner</p>
            <p className="text-sm font-normal">{file.owner || "Me"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Modified</p>
            <p className="text-sm font-normal">{formatDate(file.modified)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Created</p>
            <p className="text-sm font-normal">{formatDate(file.created)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Location</p>
            <p className="text-sm font-normal">{file.location || "My Drive"}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center pt-4 border-t border-border">
          <Button
            variant="destructive"
            onClick={() => {
              onDelete?.(file)
              onOpenChange(false)
            }}
            className="gap-2"
          >
            <Trash2 className="h-4 w-4" strokeWidth={1.5} />
            Delete
          </Button>
          
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => onShare?.(file)}
              className="gap-2"
            >
              <Share2 className="h-4 w-4" strokeWidth={1.5} />
              Share
            </Button>
            <Button
              onClick={() => {
                onDownload?.(file)
                onOpenChange(false)
              }}
              className="gap-2"
            >
              <Download className="h-4 w-4" strokeWidth={1.5} />
              Download
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export default FilePreviewModal
