"use client"

import { Download, Trash2, Share2, X, File } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { useEffect, useMemo, useState } from "react"
import { useAppContext } from "@/context/context"

const FilePreviewModal = ({ open, onOpenChange, file, onDownload, onDelete, onShare }) => {
  if (!file) return null

  const { token } = useAppContext()
  const [blobUrl, setBlobUrl] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const ext = useMemo(() => {
    const name = file.file_name || file.name || ""
    const idx = name.lastIndexOf(".")
    return idx >= 0 ? name.slice(idx + 1).toLowerCase() : ""
  }, [file])

  const guessedType = useMemo(() => {
    if (["png","jpg","jpeg","gif","webp","bmp","svg"].includes(ext)) return `image/${ext === "jpg" ? "jpeg" : ext}`
    if (["mp4","webm","ogg"].includes(ext)) return `video/${ext}`
    if (["mp3","wav","ogg"].includes(ext)) return ext === "mp3" ? "audio/mpeg" : `audio/${ext}`
    if (["pdf"].includes(ext)) return "application/pdf"
    if (["txt","md","csv","json","log"].includes(ext)) return "text/plain"
    return "application/octet-stream"
  }, [ext])

  useEffect(() => {
    if (!open || !file?.file_id) return
    let revoked = false
    const fetchBlob = async () => {
      try {
        setLoading(true)
        setError("")
        const res = await fetch(`http://127.0.0.1:8000/files/download_file/${file.file_id}` , {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!res.ok) {
          const err = await res.json().catch(()=>({}))
          throw new Error(err?.detail || err?.message || "Failed to load preview")
        }
        const buf = await res.arrayBuffer()
        const blob = new Blob([buf], { type: guessedType })
        const url = URL.createObjectURL(blob)
        if (!revoked) setBlobUrl(url)
      } catch (e) {
        setError(e?.message || "Preview failed")
      } finally {
        setLoading(false)
      }
    }
    fetchBlob()
    return () => {
      revoked = true
      if (blobUrl) URL.revokeObjectURL(blobUrl)
      setBlobUrl(null)
      setError("")
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, file?.file_id])

  const isImage = guessedType.startsWith("image/")
  const isVideo = guessedType.startsWith("video/")
  const isAudio = guessedType.startsWith("audio/")
  const isPDF = guessedType === "application/pdf"
  const isText = guessedType.startsWith("text/")

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
          <DialogTitle>{file.file_name || file.name}</DialogTitle>
        </DialogHeader>

        {/* File Preview Area */}
        <div className="border border-border bg-gray-50 dark:bg-gray-900 p-6 flex items-center justify-center min-h-[300px]">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading preview…</div>
          ) : error ? (
            <div className="text-center">
              <File className="h-10 w-10 mx-auto mb-2 text-muted-foreground" strokeWidth={1} />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          ) : blobUrl && (
            isImage ? (
              <img src={blobUrl} alt={file.file_name || file.name} className="max-w-full max-h-[70vh] object-contain" />
            ) : isPDF ? (
              <iframe src={blobUrl} title="PDF preview" className="w-full h-[70vh]" />
            ) : isVideo ? (
              <video controls src={blobUrl} className="max-w-full max-h-[70vh]" />
            ) : isAudio ? (
              <audio controls src={blobUrl} className="w-full" />
            ) : isText ? (
              <iframe src={blobUrl} title="Text preview" className="w-full h-[70vh] bg-white" />
            ) : (
              <div className="text-center">
                <File className="h-10 w-10 mx-auto mb-2 text-muted-foreground" strokeWidth={1} />
                <p className="text-sm text-muted-foreground">Preview not available for this file type</p>
              </div>
            )
          )}
        </div>

        {/* File Info */}
        <div className="grid grid-cols-2 gap-4 py-4 border-t border-border">
          <div>
            <p className="text-xs text-muted-foreground mb-1">Type</p>
            <p className="text-sm font-normal">{guessedType || "Unknown"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Size</p>
            <p className="text-sm font-normal">{formatFileSize(file.file_size ?? file.size)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Owner</p>
            <p className="text-sm font-normal">{file.owner || "Me"}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Modified</p>
            <p className="text-sm font-normal">{formatDate(file.updated_at || file.modified)}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground mb-1">Created</p>
            <p className="text-sm font-normal">{formatDate(file.created_at || file.created)}</p>
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

