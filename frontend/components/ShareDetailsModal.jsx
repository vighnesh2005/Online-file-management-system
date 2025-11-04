'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { X, Users, Globe, Eye, Edit, Trash2, Copy, Check } from 'lucide-react';

export default function ShareDetailsModal({ item, token, onClose }) {
  const [shares, setShares] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copiedToken, setCopiedToken] = useState(null);
  const [editingShare, setEditingShare] = useState(null);
  const [newPermission, setNewPermission] = useState('view');
  const [newIsPublic, setNewIsPublic] = useState(false);
  const [newEmails, setNewEmails] = useState('');

  useEffect(() => {
    if (item && token) {
      fetchShareDetails();
    }
  }, [item, token]);

  const fetchShareDetails = async () => {
    try {
      setLoading(true);
      setError('');
      
      const params = {};
      if (item.type === 'file') {
        params.file_id = item.id;
      } else {
        params.folder_id = item.id;
      }

      const res = await axios.get('http://127.0.0.1:8000/shares/share_details', {
        headers: { Authorization: `Bearer ${token}` },
        params,
      });

      setShares(res.data.shares || []);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.detail || 'Failed to load share details');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (token) => {
    const shareUrl = `${window.location.origin}/shared/${token}`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2000);
  };

  const handleDeleteShare = async (shareId) => {
    if (!confirm('Are you sure you want to delete this share?')) return;
    
    try {
      const formData = new FormData();
      formData.append('share_id', shareId);

      await axios.delete('http://127.0.0.1:8000/shares/delete_share', {
        headers: { Authorization: `Bearer ${token}` },
        data: formData,
      });

      await fetchShareDetails();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to delete share');
    }
  };

  const handleUpdateShare = async (share) => {
    try {
      const formData = new FormData();
      formData.append('share_id', share.share_id);
      formData.append('permission', newPermission);
      formData.append('is_public', newIsPublic);

      if (!newIsPublic && newEmails) {
        const emailList = newEmails.split(',').map(e => e.trim()).filter(e => e);
        emailList.forEach(email => formData.append('emails', email));
      }

      await axios.put('http://127.0.0.1:8000/shares/update_shares', formData, {
        headers: { Authorization: `Bearer ${token}` },
      });

      setEditingShare(null);
      setNewEmails('');
      await fetchShareDetails();
    } catch (err) {
      alert(err.response?.data?.detail || 'Failed to update share');
    }
  };

  const startEdit = (share) => {
    setEditingShare(share.share_id);
    setNewPermission(share.permission);
    setNewIsPublic(share.is_public);
    
    if (Array.isArray(share.users) && share.users.length > 0) {
      setNewEmails(share.users.map(u => u.email).join(', '));
    } else {
      setNewEmails('');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Share Details</h2>
            <p className="text-sm text-gray-600 mt-1">
              {item.name} ({item.type})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" strokeWidth={1.5} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading && (
            <div className="text-center py-8">
              <div className="w-12 h-12 border-4 border-gray-300 border-t-blue-600 rounded-full animate-spin mx-auto mb-4"></div>
              <p className="text-gray-600">Loading shares...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 p-4 rounded-lg mb-4">
              {error}
            </div>
          )}

          {!loading && !error && shares.length === 0 && (
            <div className="text-center py-8 text-gray-600">
              <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" strokeWidth={1.5} />
              <p>No active shares for this {item.type}</p>
              <p className="text-sm mt-2">Use the Share button to create a share link</p>
            </div>
          )}

          {!loading && !error && shares.length > 0 && (
            <div className="space-y-4">
              {shares.map((share) => (
                <div
                  key={share.share_id}
                  className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors"
                >
                  {editingShare === share.share_id ? (
                    // Edit Mode
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Permission
                          </label>
                          <select
                            value={newPermission}
                            onChange={(e) => setNewPermission(e.target.value)}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="view">View Only</option>
                            <option value="edit">Can Edit</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Access Type
                          </label>
                          <select
                            value={newIsPublic ? 'public' : 'private'}
                            onChange={(e) => setNewIsPublic(e.target.value === 'public')}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          >
                            <option value="private">Specific Users</option>
                            <option value="public">Public (Anyone with link)</option>
                          </select>
                        </div>
                      </div>

                      {!newIsPublic && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            User Emails (comma-separated)
                          </label>
                          <textarea
                            value={newEmails}
                            onChange={(e) => setNewEmails(e.target.value)}
                            placeholder="user1@example.com, user2@example.com"
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                          />
                        </div>
                      )}

                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUpdateShare(share)}
                          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                        >
                          Save Changes
                        </button>
                        <button
                          onClick={() => {
                            setEditingShare(null);
                            setNewEmails('');
                          }}
                          className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    // View Mode
                    <>
                      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            {share.is_public ? (
                              <>
                                <Globe className="w-4 h-4 text-green-600 flex-shrink-0" strokeWidth={1.5} />
                                <span className="text-sm font-medium text-green-600">Public Link</span>
                              </>
                            ) : (
                              <>
                                <Users className="w-4 h-4 text-blue-600 flex-shrink-0" strokeWidth={1.5} />
                                <span className="text-sm font-medium text-blue-600">Private Share</span>
                              </>
                            )}
                            <span className={`ml-auto px-2 py-1 text-xs rounded ${
                              share.permission === 'edit' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                            }`}>
                              {share.permission === 'edit' ? <><Edit className="w-3 h-3 inline mr-1" />Can Edit</> : <><Eye className="w-3 h-3 inline mr-1" />View Only</>}
                            </span>
                          </div>

                          <div className="flex items-center gap-2 mb-2">
                            <code className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded text-xs font-mono truncate">
                              {`${window.location.origin}/shared/${share.token}`}
                            </code>
                            <button
                              onClick={() => copyToClipboard(share.token)}
                              className="p-2 border border-gray-300 rounded hover:bg-gray-50 transition-colors flex-shrink-0"
                              title="Copy link"
                            >
                              {copiedToken === share.token ? (
                                <Check className="w-4 h-4 text-green-600" strokeWidth={1.5} />
                              ) : (
                                <Copy className="w-4 h-4 text-gray-600" strokeWidth={1.5} />
                              )}
                            </button>
                          </div>

                          {!share.is_public && typeof share.users !== 'string' && (
                            <div className="mt-2">
                              <p className="text-xs text-gray-500 mb-1">Shared with:</p>
                              <div className="flex flex-wrap gap-1">
                                {share.users.map((u, idx) => (
                                  <span
                                    key={idx}
                                    className="inline-flex items-center px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded"
                                  >
                                    {u.email}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {share.is_public && (
                            <p className="text-xs text-gray-500 mt-2">
                              Anyone with this link can access
                            </p>
                          )}

                          <div className="flex gap-4 text-xs text-gray-500 mt-2">
                            <span>Created: {new Date(share.created_at).toLocaleDateString()}</span>
                            <span>Updated: {new Date(share.updated_at).toLocaleDateString()}</span>
                          </div>
                        </div>

                        <div className="flex sm:flex-col gap-2">
                          <button
                            onClick={() => startEdit(share)}
                            className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm"
                          >
                            <Edit className="w-4 h-4" strokeWidth={1.5} />
                            <span className="hidden sm:inline">Edit</span>
                          </button>
                          <button
                            onClick={() => handleDeleteShare(share.share_id)}
                            className="flex items-center gap-2 px-3 py-2 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors text-sm"
                          >
                            <Trash2 className="w-4 h-4" strokeWidth={1.5} />
                            <span className="hidden sm:inline">Delete</span>
                          </button>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
