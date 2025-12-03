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
  File,
  Image as ImageIcon,
  Video,
  Music,
  Archive,
  X,
  Info,
  HardDrive
} from 'lucide-react';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const API_KEY = process.env.REACT_APP_API_KEY || 'supersecret';

export default function FilesPage() {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [dragActive, setDragActive] = useState(false);
  const [selectedFileInfo, setSelectedFileInfo] = useState(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/docker-cluster/pins`, {
        headers: { 'x-api-key': API_KEY }
      });
      
      if (response.data.success) {
        const files = response.data.pins || [];
        setFiles(files);
        toast.success(`${files.length} files loaded from cluster`);
      }
    } catch (error) {
      toast.error('Error loading files');
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
      toast.success(`File selected: ${e.target.files[0].name}`);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    
    if (!selectedFile) {
      toast.error('Please select a file first');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('description', description);
    formData.append('tags', tags);

    try {
      const response = await axios.post(`${API_URL}/docker-cluster/add`, formData, {
        headers: {
          'x-api-key': API_KEY
        }
      });

      if (response.data.success) {
        const cid = response.data.cid || response.data.file?.cid;
        toast.success(`File uploaded to cluster! CID: ${cid}`);
        setSelectedFile(null);
        setDescription('');
        setTags('');
        await loadFiles();
      }
    } catch (error) {
      toast.error('Upload failed');
      console.error('Upload error:', error);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (file) => {
    try {
      toast.loading(`Downloading ${file.hash}...`);
      
      const response = await axios.get(`${API_URL}/docker-cluster/download/${file.hash}`, {
        headers: { 'x-api-key': API_KEY },
        responseType: 'blob'
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', file.hash);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      toast.dismiss();
      toast.success(`Downloaded: ${file.hash}`);
    } catch (error) {
      toast.dismiss();
      toast.error('Download failed');
      console.error('Download error:', error);
    }
  };

  const handleDelete = async (file) => {
    if (!window.confirm(`Delete "${file.hash}"?`)) return;

    try {
      const response = await axios.delete(`${API_URL}/docker-cluster/pin/${file.hash}`, {
        headers: { 'x-api-key': API_KEY }
      });

      if (response.data.success) {
        toast.success(`Deleted: ${file.hash}`);
        await loadFiles();
      }
    } catch (error) {
      toast.error('Delete failed');
      console.error('Delete error:', error);
    }
  };

  const getFileIcon = (filename) => {
    const ext = filename.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'svg', 'webp'].includes(ext)) return ImageIcon;
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
          <h1 className="text-4xl font-bold text-white mb-2">File Management</h1>
          <p className="text-gray-400">Upload and manage your files on IPFS</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Upload Section */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle icon={Upload}>Upload File</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleUpload} className="space-y-4">
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
                        <p className="text-gray-400 mb-1">Drop file here or click to browse</p>
                        <p className="text-gray-500 text-sm">Supports all file types</p>
                      </>
                    )}
                  </div>
                </div>

                <Input
                  label="Description (optional)"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe your file"
                />

                <Input
                  label="Tags (optional)"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="tag1, tag2, tag3"
                />

                <Button
                  type="submit"
                  loading={uploading}
                  disabled={!selectedFile}
                  icon={Upload}
                  className="w-full"
                >
                  Upload to IPFS
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Files List */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle icon={HardDrive}>Stored Files</CardTitle>
              <Button
                onClick={loadFiles}
                loading={loading}
                variant="ghost"
                size="sm"
                icon={RefreshCw}
              >
                Refresh
              </Button>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-8 h-8 text-primary-500 animate-spin" />
                </div>
              ) : files.length > 0 ? (
                <div className="space-y-3">
                  <AnimatePresence>
                    {files.map((file, index) => {
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
                  <File className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-500">No files uploaded yet</p>
                  <p className="text-gray-600 text-sm mt-2">Upload your first file to get started</p>
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
                  <h3 className="text-xl font-bold text-white">File Information</h3>
                  <button
                    onClick={() => setSelectedFileInfo(null)}
                    className="text-gray-400 hover:text-white transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Name</p>
                    <p className="text-white font-medium">{selectedFileInfo.name}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">IPFS Hash</p>
                    <p className="text-white font-mono text-sm break-all">{selectedFileInfo.hash}</p>
                  </div>
                  <div>
                    <p className="text-gray-400 text-sm mb-1">Size</p>
                    <p className="text-white">{selectedFileInfo.size || 'Unknown'}</p>
                  </div>
                  {selectedFileInfo.description && (
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Description</p>
                      <p className="text-white">{selectedFileInfo.description}</p>
                    </div>
                  )}
                  {selectedFileInfo.uploadedAt && (
                    <div>
                      <p className="text-gray-400 text-sm mb-1">Uploaded</p>
                      <p className="text-white">{new Date(selectedFileInfo.uploadedAt).toLocaleString()}</p>
                    </div>
                  )}
                </div>

                <Button
                  onClick={() => setSelectedFileInfo(null)}
                  variant="primary"
                  className="w-full mt-6"
                >
                  Close
                </Button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
