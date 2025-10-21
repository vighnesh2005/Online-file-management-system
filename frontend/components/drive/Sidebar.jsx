"use client"

import { 
  HardDrive, 
  Users, 
  Clock, 
  Trash2, 
  Database,
  Moon,
  Sun
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useState } from "react"

const Sidebar = ({ className }) => {
  const [isDark, setIsDark] = useState(false)
  const [activeItem, setActiveItem] = useState("my-drive")

  const toggleTheme = () => {
    setIsDark(!isDark)
    document.documentElement.classList.toggle("dark")
  }

  const menuItems = [
    { id: "my-drive", label: "My Drive", icon: HardDrive, href: "/folder/0" },
    { id: "shared", label: "Shared with me", icon: Users, href: "/shared" },
    { id: "recent", label: "Recent", icon: Clock, href: "/recent" },
    { id: "trash", label: "Trash", icon: Trash2, href: "/recyclebin" },
  ]

  return (
    <div className={cn("w-64 h-screen bg-background border-r border-border flex flex-col", className)}>
      {/* Logo */}
      <div className="p-6 border-b border-border">
        <h1 className="text-xl font-medium">Drive</h1>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {menuItems.map((item) => {
          const Icon = item.icon
          const isActive = activeItem === item.id
          
          return (
            <a
              key={item.id}
              href={item.href}
              onClick={() => setActiveItem(item.id)}
              className={cn(
                "flex items-center gap-3 px-4 py-3 transition-fast border border-transparent",
                isActive 
                  ? "bg-black text-white dark:bg-white dark:text-black border-black dark:border-white" 
                  : "hover:bg-gray-100 dark:hover:bg-gray-800"
              )}
            >
              <Icon className="h-5 w-5" strokeWidth={1.5} />
              <span className="text-sm font-normal">{item.label}</span>
            </a>
          )
        })}
      </nav>

      {/* Storage Info */}
      <div className="p-4 border-t border-border">
        <div className="flex items-center gap-3 px-4 py-3">
          <Database className="h-5 w-5" strokeWidth={1.5} />
          <div className="flex-1">
            <div className="text-sm font-normal">Storage</div>
            <div className="text-xs text-muted-foreground mt-1">2.5 GB of 15 GB used</div>
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="mt-2 h-1 bg-gray-200 dark:bg-gray-800">
          <div className="h-full w-[16.6%] bg-black dark:bg-white"></div>
        </div>
      </div>

      {/* Theme Toggle */}
      <div className="p-4 border-t border-border">
        <button
          onClick={toggleTheme}
          className="flex items-center gap-3 px-4 py-3 w-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-fast"
        >
          {isDark ? (
            <Sun className="h-5 w-5" strokeWidth={1.5} />
          ) : (
            <Moon className="h-5 w-5" strokeWidth={1.5} />
          )}
          <span className="text-sm font-normal">
            {isDark ? "Light Mode" : "Dark Mode"}
          </span>
        </button>
      </div>
    </div>
  )
}

export default Sidebar
