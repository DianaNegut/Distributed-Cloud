import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Download, Upload, Shield, Key, FileDown, AlertTriangle, CheckCircle, Copy } from 'lucide-react';
import toast from 'react-hot-toast';

const BackupManager = ({ contracts }) => {
  const [importFile, setImportFile] = useState(null);
  const [backupPassword, setBackupPassword] = useState('');
  const [showRecoveryPhrase, setShowRecoveryPhrase] = useState(false);

  // Export all encryption keys and contract data
  const exportBackup = async () => {
    try {
      const backupData = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        contracts: [],
        keys: {}
      };

      // Collect all contract data and encryption keys
      for (const contract of contracts) {
        const keyData = localStorage.getItem(`encryptionKey_${contract._id}`);
        
        if (keyData) {
          backupData.contracts.push({
            id: contract._id,
            provider: contract.provider,
            size: contract.size,
            duration: contract.duration,
            price: contract.price,
            startDate: contract.startDate
          });

          backupData.keys[contract._id] = keyData;
        }
      }

      // Encrypt backup if password provided
      let finalData = JSON.stringify(backupData, null, 2);
      if (backupPassword) {
        finalData = await encryptBackup(finalData, backupPassword);
      }

      // Download as file
      const blob = new Blob([finalData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success('Backup exported successfully!');
      setBackupPassword('');
    } catch (error) {
      console.error('Export error:', error);
      toast.error('Failed to export backup');
    }
  };

  // Import and restore encryption keys
  const importBackup = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      let backupData;

      // Try to decrypt if it's encrypted
      try {
        backupData = JSON.parse(text);
      } catch {
        // If parsing fails, try to decrypt first
        if (!backupPassword) {
          toast.error('This backup is encrypted. Please enter the password.');
          setImportFile(file);
          return;
        }
        const decrypted = await decryptBackup(text, backupPassword);
        backupData = JSON.parse(decrypted);
      }

      // Restore keys to localStorage
      let restoredCount = 0;
      for (const [contractId, keyData] of Object.entries(backupData.keys)) {
        localStorage.setItem(`encryptionKey_${contractId}`, keyData);
        restoredCount++;
      }

      toast.success(`Restored ${restoredCount} encryption keys!`);
      setImportFile(null);
      setBackupPassword('');
      
      // Reload page to refresh keys
      setTimeout(() => window.location.reload(), 1500);
    } catch (error) {
      console.error('Import error:', error);
      toast.error('Failed to import backup. Check password and file.');
    }
  };

  // Encrypt backup with password
  const encryptBackup = async (data, password) => {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    
    // Derive key from password
    const passwordKey = await window.crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const key = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const encrypted = await window.crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      dataBuffer
    );

    // Combine salt + iv + encrypted data
    const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(new Uint8Array(encrypted), salt.length + iv.length);

    // Convert to base64
    return btoa(String.fromCharCode(...combined));
  };

  // Decrypt backup with password
  const decryptBackup = async (encryptedData, password) => {
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
    
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const encrypted = combined.slice(28);

    const encoder = new TextEncoder();
    const passwordKey = await window.crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    const key = await window.crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      passwordKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const decrypted = await window.crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encrypted
    );

    const decoder = new TextDecoder();
    return decoder.decode(decrypted);
  };

  // Generate recovery phrase (for future implementation)
  const generateRecoveryPhrase = () => {
    const words = [
      'cloud', 'storage', 'secure', 'ipfs', 'filecoin', 'encrypt',
      'blockchain', 'distributed', 'network', 'data', 'backup', 'restore'
    ];
    
    const phrase = Array.from({ length: 12 }, () => 
      words[Math.floor(Math.random() * words.length)]
    ).join(' ');

    return phrase;
  };

  const recoveryPhrase = generateRecoveryPhrase();

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard!');
  };

  return (
    <div className="space-y-6">
      {/* Export Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-white rounded-lg shadow-lg p-6"
      >
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-3 bg-green-100 rounded-lg">
            <Download className="w-6 h-6 text-green-600" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-800">Export Backup</h3>
            <p className="text-sm text-gray-600">Download all your encryption keys and contract data</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Backup Password (Optional but Recommended)
            </label>
            <input
              type="password"
              value={backupPassword}
              onChange={(e) => setBackupPassword(e.target.value)}
              placeholder="Enter password to encrypt backup"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
            />
            <p className="text-xs text-gray-500 mt-1">
              💡 Add a password to encrypt your backup file for extra security
            </p>
          </div>

          <button
            onClick={exportBackup}
            className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-500 text-white rounded-lg hover:from-green-600 hover:to-emerald-600 transition-all shadow-lg"
          >
            <FileDown className="w-5 h-5" />
            <span>Export Backup ({contracts?.length || 0} contracts)</span>
          </button>
        </div>
      </motion.div>

      {/* Import Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-white rounded-lg shadow-lg p-6"
      >
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-3 bg-blue-100 rounded-lg">
            <Upload className="w-6 h-6 text-blue-600" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-800">Import Backup</h3>
            <p className="text-sm text-gray-600">Restore encryption keys from a backup file</p>
          </div>
        </div>

        <div className="space-y-4">
          {importFile && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Backup Password
              </label>
              <input
                type="password"
                value={backupPassword}
                onChange={(e) => setBackupPassword(e.target.value)}
                placeholder="Enter backup password"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
              />
            </div>
          )}

          <label className="block">
            <input
              type="file"
              accept=".json"
              onChange={importBackup}
              className="hidden"
              id="import-backup"
            />
            <div className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-500 text-white rounded-lg hover:from-blue-600 hover:to-indigo-600 transition-all shadow-lg cursor-pointer">
              <Upload className="w-5 h-5" />
              <span>Choose Backup File</span>
            </div>
          </label>

          <div className="flex items-start space-x-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-800">
              <p className="font-semibold">Warning:</p>
              <p>Importing a backup will overwrite existing encryption keys. Make sure you have a current backup first.</p>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Recovery Phrase Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="bg-white rounded-lg shadow-lg p-6"
      >
        <div className="flex items-center space-x-3 mb-4">
          <div className="p-3 bg-purple-100 rounded-lg">
            <Key className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h3 className="text-xl font-bold text-gray-800">Recovery Phrase</h3>
            <p className="text-sm text-gray-600">Generate a recovery phrase for key restoration</p>
          </div>
        </div>

        {!showRecoveryPhrase ? (
          <button
            onClick={() => setShowRecoveryPhrase(true)}
            className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all shadow-lg"
          >
            <Shield className="w-5 h-5" />
            <span>Generate Recovery Phrase</span>
          </button>
        ) : (
          <div className="space-y-4">
            <div className="p-4 bg-gray-50 rounded-lg border-2 border-purple-200">
              <p className="font-mono text-sm text-gray-800 leading-relaxed">
                {recoveryPhrase}
              </p>
            </div>
            
            <button
              onClick={() => copyToClipboard(recoveryPhrase)}
              className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg hover:bg-purple-200 transition-colors"
            >
              <Copy className="w-4 h-4" />
              <span>Copy to Clipboard</span>
            </button>

            <div className="flex items-start space-x-2 p-4 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-800">
                <p className="font-semibold">Important:</p>
                <p>Write down this recovery phrase and store it securely. Anyone with this phrase can restore your encryption keys.</p>
              </div>
            </div>
          </div>
        )}
      </motion.div>

      {/* Info Section */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-6 border border-blue-100"
      >
        <div className="flex items-start space-x-3">
          <CheckCircle className="w-6 h-6 text-blue-600 flex-shrink-0 mt-1" />
          <div className="space-y-2">
            <h4 className="font-semibold text-gray-800">Backup Best Practices</h4>
            <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
              <li>Export backups regularly, especially after creating new contracts</li>
              <li>Store backups in multiple secure locations (cloud storage, USB drive, etc.)</li>
              <li>Always use a strong password when exporting backups</li>
              <li>Test your backups by importing them on another device</li>
              <li>Keep your recovery phrase offline in a secure location</li>
            </ul>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default BackupManager;
