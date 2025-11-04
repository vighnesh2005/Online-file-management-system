'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAppContext } from '@/context/context';
import DriveLayout from '@/components/common/DriveLayout';
import { User, Mail, Calendar, HardDrive, Key } from 'lucide-react';
import Link from 'next/link';

export default function ProfilePage() {
  const router = useRouter();
  const { user, token, hydrated, isLoggedIn } = useAppContext();

  useEffect(() => {
    if (!hydrated) return;
    if (!token || !isLoggedIn) {
      router.push('/login');
    }
  }, [hydrated, token, isLoggedIn, router]);

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

  if (!hydrated || !user) {
    return (
      <DriveLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600">Loading profile...</p>
          </div>
        </div>
      </DriveLayout>
    );
  }

  return (
    <DriveLayout>
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-semibold text-gray-900 mb-2">Profile</h1>
          <p className="text-sm sm:text-base text-gray-600">Manage your account information</p>
        </div>

        {/* Profile Card */}
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          {/* Avatar Section */}
          <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-8">
            <div className="flex items-center gap-6">
              <div className="w-24 h-24 bg-white text-blue-600 rounded-full flex items-center justify-center font-bold text-4xl shadow-lg">
                {user.username?.[0]?.toUpperCase() || user.email?.[0]?.toUpperCase() || 'U'}
              </div>
              <div className="flex-1">
                <h2 className="text-2xl font-semibold text-white mb-1">
                  {user.username || 'User'}
                </h2>
                <p className="text-blue-100">{user.email}</p>
              </div>
            </div>
          </div>

          {/* Account Details */}
          <div className="p-6 space-y-6">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Account Information</h3>
              <div className="space-y-4">
                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <User className="w-5 h-5 text-gray-500" strokeWidth={1.5} />
                  <div className="flex-1">
                    <p className="text-sm text-gray-500">Username</p>
                    <p className="font-medium text-gray-900">{user.username || 'Not set'}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <Mail className="w-5 h-5 text-gray-500" strokeWidth={1.5} />
                  <div className="flex-1">
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium text-gray-900">{user.email}</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 p-4 bg-gray-50 rounded-lg">
                  <Calendar className="w-5 h-5 text-gray-500" strokeWidth={1.5} />
                  <div className="flex-1">
                    <p className="text-sm text-gray-500">User ID</p>
                    <p className="font-medium text-gray-900">{user.user_id}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Storage Usage */}
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Storage Usage</h3>
              <div className="p-4 bg-gray-50 rounded-lg">
                <div className="flex items-center gap-4 mb-3">
                  <HardDrive className="w-5 h-5 text-gray-500" strokeWidth={1.5} />
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm text-gray-600">
                        {formatBytes(usedBytes)} of {formatBytes(TOTAL_LIMIT_BYTES)} used
                      </span>
                      <span className="text-sm font-medium text-gray-900">{usedPercent}%</span>
                    </div>
                    <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          usedPercent >= 95 ? 'bg-red-600' : usedPercent >= 85 ? 'bg-yellow-500' : 'bg-blue-600'
                        }`}
                        style={{ width: `${usedPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
                {usedPercent >= 85 && (
                  <p className="text-sm text-orange-600 mt-2">
                    {usedPercent >= 95 ? '⚠️ Storage almost full!' : '⚠️ Storage running low'}
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="pt-4 border-t border-gray-200">
              <Link href="/change-password">
                <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                  <Key className="w-4 h-4" strokeWidth={1.5} />
                  Change Password
                </button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </DriveLayout>
  );
}
