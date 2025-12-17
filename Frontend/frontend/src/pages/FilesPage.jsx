import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { 
  Upload, 
  Download, 
  Trash2, 
  FileText, 
  RefreshCw,
  File as FileIcon,
  FileImage,
  Video,
  Music,
  Archive,
  X,
  Info,
  HardDrive,
  AlertTriangle,
  ShoppingCart,
  Eye,
  Share2
} from 'lucide-react';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';
import FileEncryption from '../utils/fileEncryption';
import FileSearchFilter from '../components/filters/FileSearchFilter';
import FilePreviewModal from '../components/modals/FilePreviewModal';
import FileShareModal from '../components/modals/FileShareModal';
import { useAuth } from '../contexts/AuthContext';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const API_KEY = process.env.REACT_APP_API_KEY || 'supersecret';

export default function FilesPage() {
  const { user, sessionToken } = useAuth();
  const [files, setFiles] = useState([]);
  const [filteredFiles, setFilteredFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [selectedFileInfo, setSelectedFileInfo] = useState(null);
  const [storageInfo, setStorageInfo] = useState(null);
  const [contracts, setContracts] = useState([]);
  const [selectedContract, setSelectedContract] = useState(null);
  const [encryptionEnabled, setEncryptionEnabled] = useState(true);
  const [encryptionProgress, setEncryptionProgress] = useState({ percent: 0, message: '' });
  const [previewFile, setPreviewFile] = useState(null);
  const [shareFile, setShareFile] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (user) {
      loadFiles();
      loadContracts();
    }
  }, [user]);

  const loadContracts = async () => {
    try {
      const response = await axios.get(`${API_URL}/storage-contracts`, {
        headers: { 'x-api-key': API_KEY }
      });
      
      if (response.data.success) {
        // Filter only active contracts
        const activeContracts = (response.data.contracts || []).filter(c => c.status === 'active');
        
        // Load or generate encryption keys for contracts
        for (const contract of activeContracts) {
          // First, try to load existing key from localStorage
          const storedKey = localStorage.getItem(`contract_key_${contract.id}`);
          
          if (storedKey) {
            // Use existing key from localStorage
            contract.encryption = {
              enabled: true,
              key: storedKey,
              algorithm: 'AES-256-GCM',
              createdAt: contract.encryption?.createdAt || new Date().toISOString()
            };
            console.log(`🔑 Loaded existing encryption key for contract ${contract.id.slice(-8)}`);
          } else if (contract.encryption && contract.encryption.key) {
            // Key exists in contract, save it to localStorage
            localStorage.setItem(`contract_key_${contract.id}`, contract.encryption.key);
            console.log(`💾 Saved encryption key to localStorage for contract ${contract.id.slice(-8)}`);
          } else {
            // Generate new key only if none exists
            try {
              const { keyString } = await FileEncryption.generateKey();
              contract.encryption = {
                enabled: true,
                key: keyString,
                algorithm: 'AES-256-GCM',
                createdAt: new Date().toISOString()
              };
              localStorage.setItem(`contract_key_${contract.id}`, keyString);
              console.log(`🔐 Generated NEW encryption key for contract ${contract.id.slice(-8)}`);
            } catch (error) {
              console.error('Error generating encryption key:', error);
            }
          }
        }
        
        setContracts(activeContracts);
        
        // Auto-select first contract if available
        if (activeContracts.length > 0 && !selectedContract) {
          setSelectedContract(activeContracts[0]);
        }
      }
    } catch (error) {
      console.error('Error loading contracts:', error);
    }
  };

  useEffect(() => {
    if (user) {
      if (files.length > 0) {
        syncStorageWithFiles();
      } else {
        loadStorageInfo();
      }
    }
  }, [user, files]);

  const loadStorageInfo = async () => {
    if (!user) return;
    try {
      const response = await axios.get(`${API_URL}/user-storage/${user.username}`, {
        headers: { 
          'x-api-key': API_KEY,
          'x-session-token': sessionToken
        }
      });
      if (response.data.success) {
        setStorageInfo(response.data);
      }
    } catch (error) {
      console.error('Error loading storage info:', error);
    }
  };

  // Sincronizează datele de stocare cu fișierele existente în cluster
  const syncStorageWithFiles = async () => {
    if (!user || files.length === 0) return;
    try {
      // Pregătește lista de fișiere pentru sincronizare
      const filesToSync = files.map(f => ({
        cid: f.hash,
        name: f.name || 'Unknown',
        size: f.size || 0,
        uploadedAt: f.uploadedAt
      }));

      const response = await axios.post(`${API_URL}/user-storage/${user.username}/sync`, {
        files: filesToSync
      }, {
        headers: { 
          'x-api-key': API_KEY,
          'x-session-token': sessionToken
        }
      });

      if (response.data.success) {
        setStorageInfo(response.data);
        if (response.data.syncedFiles > 0) {
          console.log(`Sincronizate ${response.data.syncedFiles} fișiere cu contabilitatea de stocare`);
        }
      }
    } catch (error) {
      console.error('Error syncing storage:', error);
      // Fallback la încărcare normală
      loadStorageInfo();
    }
  };

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/docker-cluster/pins`, {
        headers: { 
          'x-api-key': API_KEY,
          'x-session-token': sessionToken
        }
      });
      
      if (response.data.success) {
        const allFiles = response.data.pins || [];
        // Filter files to show only those uploaded by current user
        const myFiles = allFiles.filter(file => {
          // Check if file has metadata with owner information
          const metadata = file.metadata || {};
          return metadata.owner === user.username || metadata.uploadedBy === user.username;
        });
        setFiles(myFiles);
        toast.success(`${myFiles.length} fișiere personale încărcate`);
      }
    } catch (error) {
      toast.error('Eroare la încărcarea fișierelor');
      console.error('Error loading files:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setSelectedFile(e.dataTransfer.files[0]);
      toast.success(`File selected: ${e.dataTransfer.files[0].name}`);
    }
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      toast.success(`Fișier selectat: ${e.target.files[0].name}`);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    
    if (!selectedFile) {
      toast.error('Selectează mai întâi un fișier');
      return;
    }

    // Check if contract is selected
    if (!selectedContract) {
      toast.error('Selectează un contract activ pentru a încărca fișiere!');
      return;
    }

    // Validate contract storage limits
    const fileSizeGB = selectedFile.size / (1024 * 1024 * 1024);
    const usedGB = selectedContract.storage.usedGB || 0;
    const allocatedGB = selectedContract.storage.allocatedGB;
    const availableGB = allocatedGB - usedGB;

    if (fileSizeGB > availableGB) {
      toast.error(`⚠️ Fișierul este prea mare!\n\nDimensiune fișier: ${fileSizeGB.toFixed(3)} GB\nSpațiu disponibil în contract: ${availableGB.toFixed(3)} GB\nLipsește: ${(fileSizeGB - availableGB).toFixed(3)} GB\n\nCreează un contract nou sau șterge fișiere vechi.`, { duration: 8000 });
      return;
    }

    // Warning if close to limit
    const usageAfterUpload = ((usedGB + fileSizeGB) / allocatedGB) * 100;
    if (usageAfterUpload > 80 && usageAfterUpload < 90) {
      toast('⚠️ Atenție: Vei folosi ' + usageAfterUpload.toFixed(1) + '% din contractul tău!', {
        icon: '🟠',
        duration: 5000
      });
    } else if (usageAfterUpload >= 90) {
      toast.error('🔴 Spațiu critic: Vei folosi ' + usageAfterUpload.toFixed(1) + '% din contract!', { duration: 6000 });
    }

    setUploading(true);
    let fileToUpload = selectedFile;
    let encryptionMetadata = null;

    // Encrypt file if enabled and contract has encryption key
    if (encryptionEnabled && selectedContract.encryption && selectedContract.encryption.key) {
      const toastId = toast.loading('🔒 Criptare fișier...');
      
      try {
        console.log('Starting encryption...');
        const cryptoKey = await FileEncryption.importKey(selectedContract.encryption.key);
        console.log('Key imported successfully');
        
        const encryptionResult = await FileEncryption.encryptFile(
          selectedFile,
          cryptoKey,
          null // Disable progress callback to isolate issue
        );

        console.log('Encryption complete:', encryptionResult);

        fileToUpload = new File(
          [encryptionResult.encryptedBlob],
          selectedFile.name + '.encrypted',
          { type: 'application/octet-stream' }
        );

        encryptionMetadata = {
          encrypted: true,
          iv: encryptionResult.iv,
          originalName: encryptionResult.originalName,
          originalSize: encryptionResult.originalSize,
          algorithm: 'AES-256-GCM'
        };

        toast.dismiss(toastId);
        toast.success(`✅ Fișier criptat (${(encryptionResult.encryptedSize / 1024 / 1024).toFixed(2)} MB)`);
      } catch (error) {
        console.error('Encryption error:', error);
        toast.dismiss(toastId);
        toast.error(`❌ Eroare la criptare: ${error.message}`);
        setUploading(false);
        setEncryptionProgress({ percent: 0, message: '' });
        return;
      }
    }

    const formData = new FormData();
    formData.append('file', fileToUpload);
    formData.append('description', description);
    formData.append('tags', tags);
    formData.append('owner', user.username); // Add owner information
    formData.append('uploadedBy', user.username); // Add uploader information
    formData.append('contractId', selectedContract.id);
    if (encryptionMetadata) {
      formData.append('encryption', JSON.stringify(encryptionMetadata));
    }

    try {
      const response = await axios.post(`${API_URL}/docker-cluster/add`, formData, {
        headers: {
          'x-api-key': API_KEY,
          'x-session-token': sessionToken,
          'x-user-id': user.username
        }
      });

      if (response.data.success) {
        const cid = response.data.cid || response.data.file?.cid;
        const fileSizeGB = selectedFile.size / (1024 * 1024 * 1024);
        
        // Update contract storage
        try {
          const fileMetadata = {
            cid,
            name: fileToUpload.name, // Use encrypted filename if encrypted
            originalName: selectedFile.name, // Keep original name
            size: selectedFile.size,
            uploadedAt: new Date().toISOString(),
            contractId: selectedContract.id
          };
          
          // Add encryption metadata if file was encrypted
          if (encryptionMetadata) {
            fileMetadata.encryption = encryptionMetadata;
          }
          
          await axios.patch(`${API_URL}/storage-contracts/${selectedContract.id}/storage`, {
            usedGB: selectedContract.storage.usedGB + fileSizeGB,
            files: [...(selectedContract.storage.files || []), fileMetadata]
          }, {
            headers: { 'x-api-key': API_KEY }
          });
        } catch (updateError) {
          console.error('Error updating contract storage:', updateError);
        }
        
        const encryptionStatus = encryptionMetadata ? ' 🔒 Criptat' : '';
        toast.success(`✅ Fișier încărcat!${encryptionStatus}\nCID: ${cid}\nContract: ${selectedContract.id.slice(-8)}`, { duration: 5000 });
        
        // Display storage warnings
        if (response.data.storageWarning) {
          if (response.data.storageWarning.status === 'critical') {
            toast.error(response.data.storageWarning.message, { duration: 6000 });
          } else if (response.data.storageWarning.status === 'warning') {
            toast(response.data.storageWarning.message, { 
              icon: '⚠️',
              duration: 5000 
            });
          }
        }

        setSelectedFile(null);
        setDescription('');
        setTags('');
        setEncryptionProgress({ percent: 0, message: '' });
        await loadFiles();
        await loadStorageInfo();
        await loadContracts(); // Refresh contracts
      }
    } catch (error) {
      if (error.response?.data?.storageExceeded) {
        toast.error(error.response.data.error, { duration: 6000 });
        toast(error.response.data.suggestion, { icon: '💡', duration: 5000 });
      } else {
        toast.error('Încărcare eșuată');
      }
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (file) => {
    const toastId = toast.loading(`📥 Descărcare ${file.name || file.hash}...`);
    
    try {
      // Download encrypted file from IPFS
      const response = await axios.get(`${API_URL}/docker-cluster/download/${file.hash}`, {
        headers: { 'x-api-key': API_KEY },
        responseType: 'blob'
      });

      let downloadBlob = response.data;
      let downloadName = file.name || file.hash;

      // Check if file is encrypted
      const isEncrypted = file.name?.endsWith('.encrypted') || file.encryption?.encrypted;
      
      if (isEncrypted && file.encryption) {
        try {
          toast.dismiss(toastId);
          const decryptToastId = toast.loading('🔓 Decriptare fișier...');
          
          console.log('Decrypting file:', file);
          console.log('File encryption metadata:', file.encryption);
          console.log('Available contracts:', contracts.length);
          
          // Find the contract that has the encryption key
          let fileContract = contracts.find(c => 
            c.id === file.contractId || 
            c.storage?.files?.some(f => f.cid === file.hash || f.cid === file.cid)
          );

          // If not found, try to use the currently selected contract
          if (!fileContract && selectedContract) {
            console.log('Contract not found by ID, using selected contract');
            fileContract = selectedContract;
          }

          // If still not found, reload contracts and try again
          if (!fileContract) {
            console.log('Reloading contracts to find the right one...');
            await loadContracts();
            fileContract = contracts.find(c => 
              c.id === file.contractId || 
              c.storage?.files?.some(f => f.cid === file.hash || f.cid === file.cid)
            );
          }

          if (!fileContract || !fileContract.encryption || !fileContract.encryption.key) {
            console.error('Contract not found or missing key:', fileContract);
            toast.dismiss(decryptToastId);
            toast.error('⚠️ Cheie de decriptare lipsă!\n\nAcest fișier a fost criptat cu o cheie care nu mai este disponibilă. Încearcă să ștergi și să reîncarci fișierul.', { duration: 8000 });
            return;
          }

          console.log('Using contract for decryption:', fileContract.id);
          console.log('Contract encryption key exists:', !!fileContract.encryption.key);

          // Import decryption key
          const cryptoKey = await FileEncryption.importKey(fileContract.encryption.key);
          console.log('Key imported successfully');
          
          // Prepare external metadata
          const externalMetadata = {
            originalName: file.encryption.originalName || file.originalName,
            originalSize: file.encryption.originalSize || file.size,
            mimeType: file.mimetype || 'application/octet-stream'
          };
          
          console.log('External metadata:', externalMetadata);
          
          // Decrypt file with external metadata
          const decryptionResult = await FileEncryption.decryptFile(
            downloadBlob,
            cryptoKey,
            file.encryption.iv,
            externalMetadata
          );

          downloadBlob = decryptionResult.decryptedBlob;
          downloadName = decryptionResult.metadata.originalName || file.encryption.originalName;
          
          toast.dismiss(decryptToastId);
          toast.success('✅ Fișier decriptat cu succes!');
          
          console.log('Decryption successful:', decryptionResult.metadata);
        } catch (decryptError) {
          toast.dismiss();
          toast.error(`❌ Eroare la decriptare: ${decryptError.message}`);
          console.error('Decryption error:', decryptError);
          return;
        }
      }

      // Create download link
      const url = window.URL.createObjectURL(downloadBlob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', downloadName);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.dismiss(toastId);
      toast.success(`✅ Descărcat: ${downloadName}`);
    } catch (error) {
      toast.dismiss(toastId);
      toast.error('❌ Descărcare eșuată');
      console.error('Download error:', error);
    }
  };

  const handleDelete = async (file) => {
    if (!window.confirm(`Ștergi "${file.name || file.hash}"?`)) return;

    try {
      const response = await axios.delete(`${API_URL}/docker-cluster/pin/${file.hash}`, {
        headers: { 'x-api-key': API_KEY }
      });

      if (response.data.success) {
        toast.success(`Șters: ${file.name || file.hash}`);
        await loadFiles();
        await loadStorageInfo();
      }
    } catch (error) {
      toast.error('Ștergere eșuată');
      console.error('Delete error:', error);
    }
  };

  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) return FileImage;
    if (['mp4', 'avi', 'mov', 'mkv'].includes(ext)) return Video;
    if (['mp3', 'wav', 'ogg', 'flac'].includes(ext)) return Music;
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return Archive;
    return FileText;
  };

  return (
    <div className="flex-1 overflow-auto">
      <Toaster position="top-right" />
      
      <div className="max-w-7xl mx-auto p-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-white mb-2">Gestionare Fișiere</h1>
          <p className="text-gray-400">Încărcă și gestionează fișierele tale pe IPFS</p>
        </motion.div>

        {/* Storage Usage Card */}
        {storageInfo && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <Card className={`border-l-4 ${
              storageInfo.status === 'critical' ? 'border-l-red-500' :
              storageInfo.status === 'warning' ? 'border-l-yellow-500' :
              'border-l-green-500'
            }`}>
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center justify-between flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      storageInfo.status === 'critical' ? 'bg-red-500/20' :
                      storageInfo.status === 'warning' ? 'bg-yellow-500/20' :
                      'bg-green-500/20'
                    }`}>
                      <HardDrive className={`w-6 h-6 ${
                        storageInfo.status === 'critical' ? 'text-red-400' :
                        storageInfo.status === 'warning' ? 'text-yellow-400' :
                        'text-green-400'
                      }`} />
                    </div>
                    <div>
                      <p className="text-white font-medium">
                        Stocare Utilizată: {storageInfo.storage.usedGB} GB / {storageInfo.storage.limitGB} GB
                      </p>
                      <p className="text-gray-400 text-sm">
                        {storageInfo.storage.remainingGB} GB disponibili • {storageInfo.storage.filesCount} fișiere
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div className="w-48">
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-gray-400">Utilizare</span>
                        <span className={`font-medium ${
                          storageInfo.storage.usagePercent >= 95 ? 'text-red-400' :
                          storageInfo.storage.usagePercent >= 80 ? 'text-yellow-400' :
                          'text-green-400'
                        }`}>{storageInfo.storage.usagePercent}%</span>
                      </div>
                      <div className="w-full bg-dark-700 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all ${
                            storageInfo.storage.usagePercent >= 95 ? 'bg-red-500' :
                            storageInfo.storage.usagePercent >= 80 ? 'bg-yellow-500' :
                            'bg-green-500'
                          }`}
                          style={{ width: `${Math.min(storageInfo.storage.usagePercent, 100)}%` }}
                        />
                      </div>
                    </div>
                    
                    {storageInfo.storage.isDefault && (
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => window.location.href = '/marketplace'}
                      >
                        <ShoppingCart className="w-4 h-4 mr-2" />
                        Cumpără Spațiu
                      </Button>
                    )}
                  </div>
                </div>

                {storageInfo.warning && (
                  <div className={`mt-3 p-3 rounded-lg flex items-center gap-2 ${
                    storageInfo.status === 'critical' ? 'bg-red-500/10 text-red-400' :
                    'bg-yellow-500/10 text-yellow-400'
                  }`}>
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <p className="text-sm">{storageInfo.warning}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload Section */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle icon={Upload}>Încărcare Fișier</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpload} className="space-y-4">
                {/* Contract Selector */}
                {contracts.length > 0 ? (
                  <div className="space-y-2">
                    <label className="text-gray-400 text-sm font-medium">
                      📝 Selectează Contract *
                    </label>
                    <select
                      value={selectedContract?.id || ''}
                      onChange={(e) => {
                        const contract = contracts.find(c => c.id === e.target.value);
                        setSelectedContract(contract);
                      }}
                      className="w-full bg-dark-700 text-white px-4 py-2 rounded-lg border border-dark-600 focus:border-primary-500 focus:outline-none"
                    >
                      {contracts.map(contract => {
                        const usagePercent = (contract.storage.usedGB / contract.storage.allocatedGB * 100).toFixed(1);
                        const availableGB = (contract.storage.allocatedGB - contract.storage.usedGB).toFixed(2);
                        return (
                          <option key={contract.id} value={contract.id}>
                            {contract.id.slice(-8)} • {availableGB} GB disponibili ({usagePercent}% folosit)
                          </option>
                        );
                      })}
                    </select>
                    
                    {selectedContract && (
                      <div className={`p-3 rounded-lg border ${
                        selectedContract.storage.usedGB / selectedContract.storage.allocatedGB >= 0.9 
                          ? 'bg-red-500/10 border-red-500/30' 
                          : selectedContract.storage.usedGB / selectedContract.storage.allocatedGB >= 0.8
                          ? 'bg-yellow-500/10 border-yellow-500/30'
                          : 'bg-green-500/10 border-green-500/30'
                      }`}>
                        <div className="flex justify-between items-center mb-2">
                          <span className="text-gray-400 text-xs">Stocare contract</span>
                          <span className={`text-xs font-semibold ${
                            selectedContract.storage.usedGB / selectedContract.storage.allocatedGB >= 0.9 ? 'text-red-400' :
                            selectedContract.storage.usedGB / selectedContract.storage.allocatedGB >= 0.8 ? 'text-yellow-400' :
                            'text-green-400'
                          }`}>
                            {selectedContract.storage.usedGB.toFixed(2)} / {selectedContract.storage.allocatedGB} GB
                          </span>
                        </div>
                        <div className="w-full bg-dark-800 rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full transition-all ${
                              selectedContract.storage.usedGB / selectedContract.storage.allocatedGB >= 0.9 ? 'bg-red-500' :
                              selectedContract.storage.usedGB / selectedContract.storage.allocatedGB >= 0.8 ? 'bg-yellow-500' :
                              'bg-green-500'
                            }`}
                            style={{ width: `${Math.min((selectedContract.storage.usedGB / selectedContract.storage.allocatedGB * 100), 100)}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <p className="text-yellow-400 text-sm mb-2">⚠️ Nu ai contracte active!</p>
                    <Button
                      type="button"
                      variant="primary"
                      size="sm"
                      onClick={() => window.location.href = '/marketplace'}
                      className="w-full"
                    >
                      <ShoppingCart className="w-4 h-4 mr-2" />
                      Cumpără Spațiu
                    </Button>
                  </div>
                )}

                {/* Encryption Toggle */}
                {selectedContract && selectedContract.encryption && (
                  <div className="p-3 bg-dark-700 rounded-lg border border-dark-600">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-white">🔐 Criptare End-to-End</span>
                        <button
                          type="button"
                          onClick={() => setEncryptionEnabled(!encryptionEnabled)}
                          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                            encryptionEnabled ? 'bg-green-500' : 'bg-gray-600'
                          }`}
                        >
                          <span
                            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                              encryptionEnabled ? 'translate-x-6' : 'translate-x-1'
                            }`}
                          />
                        </button>
                      </div>
                      <span className={`text-xs font-semibold ${
                        encryptionEnabled ? 'text-green-400' : 'text-gray-500'
                      }`}>
                        {encryptionEnabled ? 'ACTIVAT' : 'DEZACTIVAT'}
                      </span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {encryptionEnabled 
                        ? '✓ Fișierele sunt criptate AES-256 înainte de upload. Nimeni, nici providerul, nu le poate citi.'
                        : '⚠️ Fișierele vor fi stocate necriptate. Provider-ul le poate accesa.'}
                    </p>
                    {encryptionProgress.percent > 0 && encryptionProgress.percent < 100 && (
                      <div className="mt-2">
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-gray-400">{encryptionProgress.message}</span>
                          <span className="text-primary-400">{encryptionProgress.percent}%</span>
                        </div>
                        <div className="w-full bg-dark-800 rounded-full h-1.5">
                          <div
                            className="bg-primary-500 h-1.5 rounded-full transition-all"
                            style={{ width: `${encryptionProgress.percent}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Drag & Drop Zone */}
                <div
                  onDragEnter={handleDrag}
                  onDragLeave={handleDrag}
                  onDragOver={handleDrag}
                  onDrop={handleDrop}
                  className={`
                    relative border-2 border-dashed rounded-xl p-8
                    transition-all duration-200 cursor-pointer
                    ${dragActive 
                      ? 'border-primary-500 bg-primary-500/10' 
                      : 'border-dark-600 hover:border-primary-500/50'
                    }
                  `}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  
                  <div className="text-center">
                    <Upload className={`w-12 h-12 mx-auto mb-4 ${dragActive ? 'text-primary-500' : 'text-gray-500'}`} />
                    {selectedFile ? (
                      <>
                        <p className="text-white font-medium mb-1">{selectedFile.name}</p>
                        <p className="text-gray-400 text-sm">
                          {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="text-gray-400 mb-1">Trage fișierul aici sau clic pentru a naviga</p>
                        <p className="text-gray-500 text-sm">Suportă toate tipurile de fișiere</p>
                      </>
                    )}
                  </div>
                </div>

                <Input
                  label="Descriere (opțional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descrie fișierul tău"
                />

                <Input
                  label="Etichete (opțional)"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="etichetă1, etichetă2, etichetă3"
                />

                <Button
                  type="submit"
                  loading={uploading}
                  disabled={!selectedFile || !selectedContract || contracts.length === 0}
                  icon={Upload}
                  className="w-full"
                >
                  {!selectedContract && contracts.length > 0 ? 'Selectează Contract' : 
                   contracts.length === 0 ? 'Lipsește Contract' :
                   !selectedFile ? 'Selectează Fișier' :
                   'Încărcare pe IPFS'}
                </Button>
                
                {selectedFile && selectedContract && (
                  <div className="text-xs text-gray-500 text-center">
                    📦 Fișierul va fi salvat în contractul: {selectedContract.id.slice(-8)}
                  </div>
                )}
              </form>
            </CardContent>
          </Card>

          {/* Files List */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle icon={HardDrive}>Fișiere Stocate</CardTitle>
              <Button
                onClick={loadFiles}
                loading={loading}
                variant="ghost"
                size="sm"
                icon={RefreshCw}
              >
                Reîmprospătează
              </Button>
            </CardHeader>
            <CardContent>
              {/* Search and Filter */}
              <FileSearchFilter 
                files={files} 
                onFilterChange={setFilteredFiles}
              />

              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-8 h-8 text-primary-500 animate-spin" />
                </div>
              ) : (filteredFiles.length > 0 || files.length > 0) ? (
                <div className="space-y-3 mt-4">
                  <AnimatePresence>
                    {(filteredFiles.length > 0 ? filteredFiles : files).map((file, index) => {
                      const FileIcon = getFileIcon(file.name);
                      return (
                        <motion.div
                          key={file.hash}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -100 }}
                          transition={{ delay: index * 0.05 }}
                          className="flex items-center gap-4 p-4 bg-dark-800 rounded-xl hover:bg-dark-700 transition-colors"
                        >
                          <div className="w-10 h-10 bg-gradient-to-br from-primary-600 to-primary-500 rounded-lg flex items-center justify-center flex-shrink-0">
                            <FileIcon className="w-5 h-5 text-white" />
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <h4 className="text-white font-medium truncate">{file.name}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="default" className="text-xs">
                                {file.size || 'Unknown size'}
                              </Badge>
                              <span className="text-gray-500 text-xs font-mono truncate">
                                {file.hash?.substring(0, 12)}...
                              </span>
                            </div>
                          </div>

                          <div className="flex gap-2">
                            <Button
                              onClick={() => setPreviewFile(file)}
                              variant="ghost"
                              size="sm"
                              icon={Eye}
                              title="Preview"
                            />
                            <Button
                              onClick={() => setShareFile(file)}
                              variant="ghost"
                              size="sm"
                              icon={Share2}
                              title="Share"
                            />
                            <Button
                              onClick={() => handleDownload(file)}
                              variant="ghost"
                              size="sm"
                              icon={Download}
                            />
                            <Button
                              onClick={() => setSelectedFileInfo(file)}
                              variant="ghost"
                              size="sm"
                              icon={Info}
                            />
                            <Button
                              onClick={() => handleDelete(file)}
                              variant="ghost"
                              size="sm"
                              icon={Trash2}
                            />
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileIcon className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-500">Niciun fișier încărcat încă</p>
                  <p className="text-gray-600 text-sm mt-2">Încărcare primul fișier pentru a începe</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* File Info Modal */}
        <AnimatePresence>
          {selectedFileInfo && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
              onClick={() => setSelectedFileInfo(null)}
            >
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-dark-800 rounded-2xl p-6 max-w-lg w-full border border-dark-700"
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-xl font-bold text-white">Informații Fișier</h3>
                  <button
                    onClick={() => setSelectedFileInfo(null)}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Nume</p>
                    <p className="text-white font-medium">{selectedFileInfo.name}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Hash IPFS</p>
                    <p className="text-white font-mono text-sm break-all">{selectedFileInfo.hash}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Dimensiune</p>
                    <p className="text-white">{selectedFileInfo.size || 'Necunoscut'}</p>
                  </div>
                  {selectedFileInfo.description && (
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Descriere</p>
                      <p className="text-white">{selectedFileInfo.description}</p>
                    </div>
                  )}
                  {selectedFileInfo.uploadedAt && (
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Încărcat</p>
                      <p className="text-white">{new Date(selectedFileInfo.uploadedAt).toLocaleString()}</p>
                    </div>
                  )}
                </div>

                <Button
                  onClick={() => setSelectedFileInfo(null)}
                  variant="primary"
                  className="w-full mt-6"
                >
                  Închide
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* File Preview Modal */}
        <FilePreviewModal
          isOpen={!!previewFile}
          onClose={() => setPreviewFile(null)}
          file={previewFile}
          onDownload={handleDownload}
        />

        {/* File Share Modal */}
        <FileShareModal
          isOpen={!!shareFile}
          onClose={() => setShareFile(null)}
          file={shareFile}
        />
      </div>
    </div>
  );
}
