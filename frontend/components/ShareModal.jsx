'use client';
import { useState } from 'react';
import { Share2, Copy, Mail, Globe, Lock, Users, X, Check } from 'lucide-react';
import axios from 'axios';

export default function ShareModal({ 
  isOpen, 
  onClose, 
  item, 
  token, 
  onShareSuccess 
}) {
  const [shareData, setShareData] = useState({
    is_public: false,
    permission: 'view',
    emails: []
  });
  const [emailInput, setEmailInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [shareResult, setShareResult] = useState(null);
  const [copied, setCopied] = useState(false);

  const handleEmailAdd = () => {
    if (emailInput.trim() && !shareData.emails.includes(emailInput.trim())) {
      setShareData(prev => ({
        ...prev,
        emails: [...prev.emails, emailInput.trim()]
      }));
      setEmailInput('');
    }
  };

  const handleEmailRemove = (email) => {
    setShareData(prev => ({
      ...prev,
      emails: prev.emails.filter(e => e !== email)
    }));
  };

  const handleShare = async () => {
    setLoading(true);
    try {
      const formData = new FormData();
      
      if (item.type === 'file') {
        formData.append('file_id', item.id);
      } else {
        formData.append('folder_id', item.id);
      }
      
      // enforce: public shares cannot be edit
      const finalIsPublic = !!shareData.is_public;
      const finalPermission = finalIsPublic && shareData.permission === 'edit' ? 'view' : shareData.permission;
      formData.append('is_public', finalIsPublic);
      formData.append('permission', finalPermission);
      
      shareData.emails.forEach(email => {
        formData.append('emails', email);
      });

      const response = await axios.post(
        'http://127.0.0.1:8000/shares/share_link',
        formData,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      setShareResult(response.data);
      onShareSuccess?.(response.data);
    } catch (error) {
      console.error('Share error:', error);
      alert('Failed to share item. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Share2 className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-900">
                Share {item?.type === 'file' ? 'File' : 'Folder'}
              </h2>
              <p className="text-sm text-gray-500">{item?.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {!shareResult ? (
            <>
              {/* Share Type */}
              <div className="space-y-4">
                <h3 className="font-medium text-gray-900">Who can access</h3>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setShareData(prev => ({ ...prev, is_public: false }))}
                    className={`p-4 border-2 rounded-lg transition-all ${
                      !shareData.is_public 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Users className="w-5 h-5 text-gray-600" />
                      <div className="text-left">
                        <div className="font-medium">Specific people</div>
                        <div className="text-sm text-gray-500">Only people you invite</div>
                      </div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => setShareData(prev => ({ ...prev, is_public: true, permission: 'view' }))}
                    disabled={shareData.permission === 'edit'}
                    className={`p-4 border-2 rounded-lg transition-all ${
                      shareData.is_public 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    } ${shareData.permission === 'edit' ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <Globe className="w-5 h-5 text-gray-600" />
                      <div className="text-left">
                        <div className="font-medium">Anyone with link</div>
                        <div className="text-sm text-gray-500">Public link</div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {/* Email Input */}
              {!shareData.is_public && (
                <div className="space-y-3">
                  <label className="font-medium text-gray-900">Add people</label>
                  <div className="flex gap-2">
                    <input
                      type="email"
                      value={emailInput}
                      onChange={(e) => setEmailInput(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && handleEmailAdd()}
                      placeholder="Enter email addresses"
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <button
                      onClick={handleEmailAdd}
                      className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Add
                    </button>
                  </div>
                  
                  {/* Email Tags */}
                  {shareData.emails.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {shareData.emails.map((email, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm"
                        >
                          <Mail className="w-3 h-3" />
                          {email}
                          <button
                            onClick={() => handleEmailRemove(email)}
                            className="hover:bg-blue-200 rounded-full p-0.5"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Permissions */}
              <div className="space-y-3">
                <label className="font-medium text-gray-900">Permission</label>
                <div className="grid grid-cols-2 gap-4">
                  <button
                    onClick={() => setShareData(prev => ({ ...prev, permission: 'view' }))}
                    className={`p-4 border-2 rounded-lg transition-all ${
                      shareData.permission === 'view' 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Lock className="w-5 h-5 text-gray-600" />
                      <div className="text-left">
                        <div className="font-medium">Viewer</div>
                        <div className="text-sm text-gray-500">Can view only</div>
                      </div>
                    </div>
                  </button>
                  
                  <button
                    onClick={() => setShareData(prev => ({ ...prev, permission: 'edit', is_public: false }))}
                    className={`p-4 border-2 rounded-lg transition-all ${
                      shareData.permission === 'edit' 
                        ? 'border-blue-500 bg-blue-50' 
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Users className="w-5 h-5 text-gray-600" />
                      <div className="text-left">
                        <div className="font-medium">Editor</div>
                        <div className="text-sm text-gray-500">Can view and edit</div>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </>
          ) : (
            /* Share Result */
            <div className="space-y-4">
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-2 text-green-800">
                  <Check className="w-5 h-5" />
                  <span className="font-medium">Share created successfully!</span>
                </div>
              </div>
              
              <div className="space-y-3">
                <label className="font-medium text-gray-900">Share Token</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={shareResult.token}
                    readOnly
                    className="flex-1 px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-sm font-mono"
                  />
                  <button
                    onClick={() => copyToClipboard(shareResult.token)}
                    className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center gap-2"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  Use this token to search for shared content
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-6 border-t bg-gray-50">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-600 hover:text-gray-800 transition-colors"
          >
            {shareResult ? 'Close' : 'Cancel'}
          </button>
          {!shareResult && (
            <button
              onClick={handleShare}
              disabled={loading || (!shareData.is_public && shareData.emails.length === 0)}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Sharing...
                </>
              ) : (
                <>
                  <Share2 className="w-4 h-4" />
                  Share
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
