'use client';
import { useEffect, useMemo, useState } from 'react';
import { X, Users, Globe, Lock, Settings, Copy, Check, Trash2, Mail } from 'lucide-react';
import axios from 'axios';

export default function ShareManageModal({ isOpen, onClose, item, token }) {
  const [loading, setLoading] = useState(false);
  const [shares, setShares] = useState([]);
  const [copied, setCopied] = useState(null);

  const [editShareId, setEditShareId] = useState(null);
  const [form, setForm] = useState({ is_public: false, permission: 'view', emails: [], emailInput: '' });

  const targetParams = useMemo(() => {
    if (!item) return {};
    if (item.type === 'file') return { file_id: item.id };
    return { folder_id: item.id };
  }, [item]);

  useEffect(() => {
    if (!isOpen || !item) return;
    const fetchDetails = async () => {
      try {
        setLoading(true);
        const res = await axios.get('http://127.0.0.1:8000/shares/share_details', {
          params: targetParams,
        });
        setShares(res.data?.shares || []);
      } catch (e) {
        alert(e.response?.data?.detail || 'Failed to load share details');
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [isOpen, item, targetParams]);

  const copyToken = async (tokenValue) => {
    try {
      await navigator.clipboard.writeText(tokenValue);
      setCopied(tokenValue);
      setTimeout(() => setCopied(null), 1500);
    } catch {}
  };

  const startEdit = (s) => {
    setEditShareId(s.share_id);
    const emails = Array.isArray(s.users) ? s.users.map(u => u.email) : [];
    // enforce: public shares cannot be edit
    const initialPublic = !!s.is_public;
    const initialPerm = s.permission || 'view';
    const coerced = initialPublic && initialPerm === 'edit' ? 'view' : initialPerm;
    setForm({ is_public: initialPublic && coerced !== 'edit', permission: coerced, emails, emailInput: '' });
  };

  const cancelEdit = () => {
    setEditShareId(null);
    setForm({ is_public: false, permission: 'view', emails: [], emailInput: '' });
  };

  const addEmail = () => {
    const e = form.emailInput.trim();
    if (!e) return;
    if (form.emails.includes(e)) return;
    setForm(prev => ({ ...prev, emails: [...prev.emails, e], emailInput: '' }));
  };

  const removeEmail = (e) => {
    setForm(prev => ({ ...prev, emails: prev.emails.filter(x => x !== e) }));
  };

  const saveShare = async () => {
    if (!editShareId) return;
    try {
      setLoading(true);
      const data = new FormData();
      data.append('share_id', editShareId);
      // enforce rule: if public, permission must be view
      const finalIsPublic = !!form.is_public;
      const finalPermission = finalIsPublic && form.permission === 'edit' ? 'view' : form.permission;
      data.append('is_public', String(finalIsPublic));
      data.append('permission', finalPermission);
      form.emails.forEach(e => data.append('emails', e));

      const res = await axios.put('http://127.0.0.1:8000/shares/update_shares', data, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.status === 200) {
        const refresh = await axios.get('http://127.0.0.1:8000/shares/share_details', { params: targetParams });
        setShares(refresh.data?.shares || []);
        cancelEdit();
      }
    } catch (e) {
      alert(e.response?.data?.detail || 'Failed to update share');
    } finally {
      setLoading(false);
    }
  };

  const deleteShare = async (share_id) => {
    try {
      setLoading(true);
      const fd = new FormData();
      fd.append('share_id', share_id);
      const res = await fetch('http://127.0.0.1:8000/shares/delete_share', {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail || 'Failed to delete share');
      }
      const refresh = await axios.get('http://127.0.0.1:8000/shares/share_details', { params: targetParams });
      setShares(refresh.data?.shares || []);
      if (editShareId === share_id) cancelEdit();
    } catch (e) {
      alert(e.message || 'Failed to delete share');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen || !item) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-indigo-100 rounded-lg">
              <Settings className="w-5 h-5 text-indigo-700" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Manage Permissions</h2>
              <p className="text-sm text-gray-500">{item?.name} ({item?.type})</p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          {loading && <div className="text-sm text-gray-600">Loading...</div>}

          {!loading && shares.map(s => (
            <div key={s.share_id} className="border rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${s.is_public ? 'bg-green-100' : 'bg-gray-100'}`}>
                    {s.is_public ? <Globe className="w-4 h-4 text-green-700" /> : <Users className="w-4 h-4 text-gray-700" />}
                  </div>
                  <div>
                    <div className="text-sm text-gray-700">Token</div>
                    <div className="font-mono text-xs bg-gray-50 border rounded px-2 py-1 inline-block">{s.token}</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => copyToken(s.token)} className="px-2 py-1 text-sm bg-gray-600 text-white rounded hover:bg-gray-700 flex items-center gap-1">
                    {copied === s.token ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />} {copied === s.token ? 'Copied' : 'Copy'}
                  </button>
                  <button onClick={() => deleteShare(s.share_id)} className="px-2 py-1 text-sm bg-red-600 text-white rounded hover:bg-red-700 flex items-center gap-1">
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                  {editShareId !== s.share_id && (
                    <button onClick={() => startEdit(s)} className="px-2 py-1 text-sm border rounded hover:bg-gray-50">Edit</button>
                  )}
                </div>
              </div>

              {editShareId === s.share_id ? (
                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      onClick={() => setForm(prev => ({ ...prev, is_public: false }))}
                      className={`p-3 border-2 rounded ${!form.is_public ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                    >
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        <div>
                          <div className="text-sm font-medium">Specific people</div>
                          <div className="text-xs text-gray-500">Only invited users</div>
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => setForm(prev => ({ ...prev, is_public: true, permission: 'view' }))}
                      disabled={form.permission === 'edit'}
                      className={`p-3 border-2 rounded ${form.is_public ? 'border-blue-500 bg-blue-50' : 'border-gray-200'} ${form.permission === 'edit' ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-center gap-2">
                        <Globe className="w-4 h-4" />
                        <div>
                          <div className="text-sm font-medium">Anyone with link</div>
                          <div className="text-xs text-gray-500">Public access</div>
                        </div>
                      </div>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <button
                      onClick={() => setForm(prev => ({ ...prev, permission: 'view' }))}
                      className={`p-3 border-2 rounded ${form.permission === 'view' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}
                    >
                      <div className="flex items-center gap-2">
                        <Lock className="w-4 h-4" />
                        <div>
                          <div className="text-sm font-medium">Viewer</div>
                          <div className="text-xs text-gray-500">Can view only</div>
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => setForm(prev => ({ ...prev, permission: 'edit', is_public: false }))}
                      disabled={form.is_public}
                      className={`p-3 border-2 rounded ${form.permission === 'edit' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'} ${form.is_public ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4" />
                        <div>
                          <div className="text-sm font-medium">Editor</div>
                          <div className="text-xs text-gray-500">Can edit</div>
                        </div>
                      </div>
                    </button>
                  </div>

                  {!form.is_public && (
                    <div className="space-y-2">
                      <div className="text-sm font-medium text-gray-700">Allowed users</div>
                      <div className="flex gap-2">
                        <input
                          type="email"
                          value={form.emailInput}
                          onChange={e => setForm(prev => ({ ...prev, emailInput: e.target.value }))}
                          onKeyDown={e => e.key === 'Enter' && addEmail()}
                          placeholder="Enter email"
                          className="flex-1 px-3 py-2 border rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                        <button onClick={addEmail} className="px-3 py-2 bg-blue-600 text-white rounded">Add</button>
                      </div>
                      {form.emails.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {form.emails.map((e, i) => (
                            <span key={i} className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs">
                              <Mail className="w-3 h-3" /> {e}
                              <button onClick={() => removeEmail(e)} className="hover:bg-blue-200 rounded-full p-0.5">×</button>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  <div className="flex justify-end gap-2">
                    <button onClick={cancelEdit} className="px-4 py-2 text-gray-600">Cancel</button>
                    <button onClick={saveShare} disabled={loading} className="px-4 py-2 bg-indigo-600 text-white rounded disabled:opacity-50">Save</button>
                  </div>
                </div>
              ) : (
                <div className="mt-3 text-sm text-gray-700">
                  <div className="mb-2"><span className="font-medium">Permission:</span> {s.permission}</div>
                  <div>
                    <span className="font-medium">Users:</span>
                    {s.is_public ? (
                      <span className="ml-2">Anyone with the link</span>
                    ) : (
                      <ul className="list-disc ml-6 mt-1">
                        {(Array.isArray(s.users) ? s.users : []).map(u => (
                          <li key={u.user_id}>{u.username || u.email} ({u.email})</li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}

          {!loading && shares.length === 0 && (
            <div className="text-sm text-gray-600">No shares yet for this item.</div>
          )}
        </div>

        <div className="flex justify-end gap-2 p-6 border-t bg-gray-50">
          <button onClick={onClose} className="px-4 py-2">Close</button>
        </div>
      </div>
    </div>
  );
}
