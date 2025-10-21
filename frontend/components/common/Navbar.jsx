"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowLeft, Search, Recycle, List } from "lucide-react"

export default function Navbar() {
  const router = useRouter()

  return (
    <header className="w-full bg-background border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14">
          {/* Left: Back Button */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.back()}
              className="h-8 w-8 inline-flex items-center justify-center border border-border bg-background text-foreground transition-all duration-150 hover:bg-blue-600 hover:text-white hover:border-blue-600"
              aria-label="Go back"
              title="Go back"
            >
              <ArrowLeft className="h-4 w-4" strokeWidth={1.5} />
            </button>
            <span className="text-sm font-medium">Drive</span>
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2">
            {/* Search Token Button */}
            <Link href="/folder/0">
              <button className="h-8 px-3 inline-flex items-center gap-2 border border-border bg-background text-foreground text-sm transition-all duration-150 hover:bg-purple-600 hover:text-white hover:border-purple-600">
                <Search className="h-4 w-4" strokeWidth={1.5} />
                <span className="hidden sm:inline">Search</span>
              </button>
            </Link>

            {/* Recycle Bin Button */}
            <Link href="/recyclebin">
              <button className="h-8 px-3 inline-flex items-center gap-2 border border-border bg-background text-foreground text-sm transition-all duration-150 hover:bg-red-600 hover:text-white hover:border-red-600">
                <Recycle className="h-4 w-4" strokeWidth={1.5} />
                <span className="hidden sm:inline">Recycle Bin</span>
              </button>
            </Link>

            {/* Logs Button */}
            <Link href="/logs">
              <button className="h-8 px-3 inline-flex items-center gap-2 border border-border bg-background text-foreground text-sm transition-all duration-150 hover:bg-gray-800 hover:text-white hover:border-gray-800 dark:hover:bg-gray-200 dark:hover:text-black dark:hover:border-gray-200">
                <List className="h-4 w-4" strokeWidth={1.5} />
                <span className="hidden sm:inline">Logs</span>
              </button>
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}
