"use client"

import { Search, Upload, User } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { useState } from "react"

const TopBar = ({ onUploadClick }) => {
  const [searchQuery, setSearchQuery] = useState("")

  return (
    <div className="h-16 bg-background border-b border-border flex items-center px-6 gap-4">
      {/* Search Bar */}
      <div className="flex-1 max-w-2xl relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" strokeWidth={1.5} />
        <Input
          type="text"
          placeholder="Search in Drive"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10 border-black dark:border-white"
        />
      </div>

      {/* Upload Button */}
      <Button
        onClick={onUploadClick}
        className="gap-2"
      >
        <Upload className="h-4 w-4" strokeWidth={1.5} />
        <span>Upload</span>
      </Button>

      {/* Profile Icon */}
      <button className="h-10 w-10 border border-border hover:bg-gray-100 dark:hover:bg-gray-800 transition-fast flex items-center justify-center">
        <User className="h-5 w-5" strokeWidth={1.5} />
      </button>
    </div>
  )
}

export default TopBar
