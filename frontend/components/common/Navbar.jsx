"use client"

import { useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import { Search, LogOut, User, Key } from "lucide-react"
import { useAppContext } from "@/context/context"
import axios from "axios"
import TokenSearch from "../TokenSearch"

export default function Navbar() {
  const router = useRouter()
  const pathname = usePathname()
  const { user, token, setIsLoggedIn, setToken, setUser } = useAppContext()
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchScope, setSearchScope] = useState("global") // "global" or "local"
  const [showScopeMenu, setShowScopeMenu] = useState(false)
  const [showTokenSearch, setShowTokenSearch] = useState(false)

  const handleSearch = () => {
    if (!searchQuery.trim()) return;
    
    // Only navigate if on folder page
    const isFolderPage = pathname?.startsWith('/folder/');
    if (!isFolderPage) {
      router.push('/folder/0');
      return;
    }
    
    // Trigger search on current folder page via URL params
    const folderId = pathname.split('/folder/')[1];
    const params = new URLSearchParams();
    params.set('q', searchQuery.trim());
    if (searchScope === 'local' && folderId) {
      params.set('scope', 'local');
    }
    router.push(`/folder/${folderId}?${params.toString()}`);
  };

  const handleLogout = () => {
    localStorage.removeItem("token")
    setIsLoggedIn(false)
    setToken(null)
    setUser(null)
    router.push("/login")
  }

  return (
    <header className="w-full bg-white border-b border-gray-200 sticky top-0 z-30">
      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Left: Logo (hidden on mobile, shown on desktop when sidebar collapsed) */}
          <div className="flex items-center gap-4 flex-1 min-w-0">
            <div className="hidden lg:flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center">
                <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
                </svg>
              </div>
              <span className="text-xl font-normal text-gray-700">Drive</span>
            </div>

            {/* Search Bar */}
            <div className="flex-1 max-w-2xl ml-0 lg:ml-8">
              <div className="flex items-center gap-2">
                {/* Scope Selector */}
                <div className="relative">
                  <button
                    onClick={() => setShowScopeMenu(!showScopeMenu)}
                    className="px-3 py-2.5 bg-gray-100 hover:bg-gray-200 border border-transparent rounded-lg text-sm font-medium text-gray-700 transition-colors whitespace-nowrap"
                  >
                    {searchScope === 'global' ? 'All' : 'Folder'}
                  </button>
                  
                  {showScopeMenu && (
                    <>
                      <div className="fixed inset-0 z-30" onClick={() => setShowScopeMenu(false)} />
                      <div className="absolute top-full left-0 mt-1 w-40 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-40">
                        <button
                          onClick={() => {
                            setSearchScope('global');
                            setShowScopeMenu(false);
                          }}
                          className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 ${searchScope === 'global' ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'}`}
                        >
                          All Drives
                        </button>
                        <button
                          onClick={() => {
                            setSearchScope('local');
                            setShowScopeMenu(false);
                          }}
                          className={`w-full px-4 py-2 text-left text-sm hover:bg-gray-100 ${searchScope === 'local' ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-700'}`}
                        >
                          This Folder
                        </button>
                      </div>
                    </>
                  )}
                </div>

                {/* Search Input */}
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" strokeWidth={1.5} />
                  <input
                    type="text"
                    placeholder="Search in Drive"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && searchQuery.trim()) {
                        handleSearch();
                      }
                    }}
                    className="w-full pl-10 pr-4 py-2.5 bg-gray-100 hover:bg-gray-200 focus:bg-white border border-transparent focus:border-blue-500 rounded-lg text-sm transition-colors outline-none"
                  />
                </div>

                {/* Search Button */}
                <button
                  onClick={handleSearch}
                  disabled={!searchQuery.trim()}
                  className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm font-medium whitespace-nowrap"
                >
                  Search
                </button>
              </div>
            </div>
          </div>

          {/* Right: User Actions */}
          <div className="flex items-center gap-2 ml-4">
            {/* Search Token Button */}
            <button
              onClick={() => setShowTokenSearch(true)}
              className="p-2 text-gray-600 hover:bg-gray-100 rounded-full transition-colors"
              title="Search by Token"
            >
              <Key className="w-5 h-5" strokeWidth={1.5} />
            </button>

            {/* User Profile */}
            <div className="relative">
              <button
                onClick={() => setShowUserMenu(!showUserMenu)}
                className="w-9 h-9 bg-blue-600 text-white rounded-full flex items-center justify-center font-medium text-sm hover:bg-blue-700 transition-colors"
                title={user?.email || "User"}
              >
                {user?.username?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
              </button>

              {/* User Dropdown Menu */}
              {showUserMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-40" 
                    onClick={() => setShowUserMenu(false)}
                  />
                  <div className="absolute right-0 mt-2 w-72 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                    <div className="px-4 py-3 border-b border-gray-200">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center font-medium text-lg">
                          {user?.username?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'U'}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-gray-900 truncate">
                            {user?.username || 'User'}
                          </p>
                          <p className="text-sm text-gray-500 truncate">
                            {user?.email || 'user@example.com'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="py-2">
                      <button
                        onClick={() => {
                          setShowUserMenu(false)
                          router.push('/profile')
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
                      >
                        <User className="w-4 h-4" strokeWidth={1.5} />
                        Manage your account
                      </button>
                      <button
                        onClick={() => {
                          setShowUserMenu(false)
                          handleLogout()
                        }}
                        className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-3"
                      >
                        <LogOut className="w-4 h-4" strokeWidth={1.5} />
                        Sign out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Token Search Modal */}
      <TokenSearch
        isOpen={showTokenSearch}
        onClose={() => setShowTokenSearch(false)}
        token={token}
      />
    </header>
  )
}
