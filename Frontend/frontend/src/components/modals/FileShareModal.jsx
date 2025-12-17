import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Share2, Link as LinkIcon, Link2, Copy, Check, Clock, Lock, X } from 'lucide-react';
import toast from 'react-hot-toast';

export const FileShareModal = ({ file, onClose, isOpen }) => {
  const [shareLink, setShareLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [settings, setSettings] = useState({
    password: '',
    expiresIn: '7',
    allowDownload: true
  });
  const [loading, setLoading] = useState(false);

  // Return null if modal is not open or file is not provided
  if (!isOpen || !file) {
    return null;
  }

  const generateShareLink = async () => {
    setLoading(true);
    try {
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const baseUrl = window.location.origin;
      const shareId = btoa(`${file.hash}-${Date.now()}`).substring(0, 16);
      const link = `${baseUrl}/share/${shareId}`;
      
      setShareLink(link);
      
      // In production, save share settings to backend
      console.log('Share settings:', {
        fileHash: file.hash,
        ...settings
      });
    } catch (error) {
      console.error('Error generating share link:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(shareLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl bg-dark-900 rounded-xl shadow-2xl overflow-hidden"
      >
        <div className="flex flex-row items-center justify-between p-6 border-b border-dark-700">
          <div className="flex items-center gap-3">
            <Share2 className="w-6 h-6 text-primary-400" />
            <h2 className="text-xl font-bold text-white">Partajare Fișier</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
            {/* File Info */}
            <div className="bg-dark-700 rounded-lg p-4">
              <h4 className="text-white font-medium mb-2">{file.name}</h4>
              <div className="flex items-center gap-4 text-sm text-gray-400">
                <span>{file.size}</span>
                <span>•</span>
                <span className="font-mono">{file.hash?.substring(0, 12)}...</span>
              </div>
            </div>

            {/* Share Settings */}
            <div className="space-y-4">
              <h3 className="text-white font-medium">Setări Partajare</h3>

              {/* Password Protection */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Protecție cu parolă (opțional)
                </label>
                <input
                  type="password"
                  value={settings.password}
                  onChange={(e) => setSettings({...settings, password: e.target.value})}
                  placeholder="Introdu o parolă pentru protecție"
                  className="w-full px-4 py-3 bg-dark-800 border border-dark-600 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>

              {/* Expiration */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Expiră în
                </label>
                <select
                  value={settings.expiresIn}
                  onChange={(e) => setSettings({...settings, expiresIn: e.target.value})}
                  className="w-full px-4 py-3 bg-dark-800 border border-dark-600 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="1">1 zi</option>
                  <option value="7">7 zile</option>
                  <option value="30">30 zile</option>
                  <option value="never">Niciodată</option>
                </select>
              </div>

              {/* Download Permission */}
              <div className="flex items-center justify-between bg-dark-700 rounded-lg p-4">
                <span className="text-white">Permite download</span>
                <button
                  onClick={() => setSettings({...settings, allowDownload: !settings.allowDownload})}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    settings.allowDownload ? 'bg-green-500' : 'bg-gray-600'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.allowDownload ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>

            {/* Generate Link Button */}
            {!shareLink && (
              <button
                onClick={generateShareLink}
                disabled={loading}
                className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-xl font-medium hover:from-purple-700 hover:to-pink-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <Link2 className="w-5 h-5" />
                )}
                Generează Link de Partajare
              </button>
            )}

            {/* Share Link Display */}
            {shareLink && (
              <div className="space-y-3">
                <div className="bg-dark-700 rounded-lg p-4 flex items-center gap-3">
                  <LinkIcon className="w-5 h-5 text-primary-400 flex-shrink-0" />
                  <input
                    type="text"
                    value={shareLink}
                    readOnly
                    className="flex-1 bg-transparent text-white text-sm focus:outline-none"
                  />
                  <button
                    onClick={copyToClipboard}
                    className="px-3 py-2 bg-dark-600 hover:bg-dark-500 text-white rounded-lg text-sm flex items-center gap-2 transition-colors"
                  >
                    {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copied ? 'Copiat!' : 'Copiază'}
                  </button>
                </div>

                <div className="text-sm text-gray-400 space-y-1">
                  <p>✓ Link generat cu succes</p>
                  {settings.password && <p>🔒 Protejat cu parolă</p>}
                  {settings.expiresIn !== 'never' && (
                    <p>⏰ Expiră în {settings.expiresIn} {settings.expiresIn === '1' ? 'zi' : 'zile'}</p>
                  )}
                  {!settings.allowDownload && <p>👁️ Doar vizualizare (fără download)</p>}
                </div>
              </div>
            )}
        </div>
      </motion.div>
    </motion.div>
    </AnimatePresence>
  );
};

export default FileShareModal;
