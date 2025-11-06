'use client';

import { useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { 
  HardDrive, 
  Users, 
  Clock, 
  Star, 
  Trash2, 
  FileText,
  PieChart,
  ChevronLeft,
  ChevronRight,
  Menu,
  X
} from 'lucide-react';
import { useAppContext } from '@/context/context';

export default function Sidebar() {
  const pathname = usePathname();
  const { user } = useAppContext();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  const formatBytes = (bytes) => {
    if (!bytes && bytes !== 0) return '0 B';
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 B';
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    const val = bytes / Math.pow(1024, i);
    return `${val.toFixed(i === 0 ? 0 : 1)} ${sizes[i]}`;
  };

  const TOTAL_LIMIT_BYTES = 10 * 1024 * 1024 * 1024;
  const usedBytes = user?.storage || 0;
  const usedPercent = Math.min(100, Math.round((usedBytes / TOTAL_LIMIT_BYTES) * 100));

  const menuItems = [
    { 
      icon: HardDrive, 
      label: 'My Drive', 
      href: '/folder/0',
      active: pathname?.startsWith('/folder')
    },
    {
      icon: Star,
      label: 'Starred',
      href: '/starred',
      active: pathname === '/starred'
    },
    { 
      icon: Users, 
      label: 'Shared with me', 
      href: '/shared',
      active: pathname === '/shared'
    },
    { 
      icon: Trash2, 
      label: 'Recycle Bin', 
      href: '/recyclebin',
      active: pathname === '/recyclebin'
    },
    { 
      icon: PieChart, 
      label: 'Storage Insights', 
      href: '/storage',
      active: pathname === '/storage'
    },
    { 
      icon: FileText, 
      label: 'Activity Logs', 
      href: '/logs',
      active: pathname === '/logs'
    },
  ];

  const SidebarContent = () => (
    <>

      {/* Navigation Items */}
      <nav className="flex-1 px-2 py-4 space-y-1 overflow-y-auto">
        {menuItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.active;
          
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${
                isActive
                  ? 'bg-blue-50 text-blue-600 font-medium'
                  : 'text-gray-700 hover:bg-gray-100'
              }`}
            >
              <Icon 
                className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-blue-600' : 'text-gray-500'}`} 
                strokeWidth={1.5} 
              />
              {!collapsed && (
                <span className="flex-1 truncate">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Storage Info */}
      {!collapsed && (
        <div className="p-4 border-t border-gray-200">
          <div className="mb-2">
            <div className="flex items-center justify-between text-xs text-gray-600 mb-1">
              <span>Storage</span>
              <span>{usedPercent}%</span>
            </div>
            <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${
                  usedPercent >= 95 ? 'bg-red-600' : usedPercent >= 85 ? 'bg-yellow-500' : 'bg-blue-600'
                }`}
                style={{ width: `${usedPercent}%` }}
              />
            </div>
          </div>
          <p className="text-xs text-gray-500">
            {formatBytes(usedBytes)} of {formatBytes(TOTAL_LIMIT_BYTES)} used
          </p>
        </div>
      )}

      {/* Collapse Toggle (Desktop only) */}
      <div className="hidden lg:block p-2 border-t border-gray-200">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="w-full flex items-center justify-center p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {collapsed ? (
            <ChevronRight className="w-5 h-5" strokeWidth={1.5} />
          ) : (
            <ChevronLeft className="w-5 h-5" strokeWidth={1.5} />
          )}
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile Menu Button */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-white border border-gray-200 rounded-lg shadow-sm hover:bg-gray-50 transition-colors"
        aria-label="Toggle menu"
      >
        {mobileOpen ? (
          <X className="w-5 h-5 text-gray-700" strokeWidth={1.5} />
        ) : (
          <Menu className="w-5 h-5 text-gray-700" strokeWidth={1.5} />
        )}
      </button>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile Sidebar */}
      <aside
        className={`lg:hidden fixed top-0 left-0 bottom-0 z-40 w-64 bg-white border-r border-gray-200 transform transition-transform duration-300 ${
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="h-full flex flex-col">
          <SidebarContent />
        </div>
      </aside>

      {/* Desktop Sidebar */}
      <aside
        className={`hidden lg:flex flex-col bg-white border-r border-gray-200 transition-all duration-300 ${
          collapsed ? 'w-20' : 'w-64'
        }`}
      >
        <SidebarContent />
      </aside>
    </>
  );
}
