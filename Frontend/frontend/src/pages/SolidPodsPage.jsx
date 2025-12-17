import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Box, 
  Shield, 
  Upload, 
  Download, 
  Users, 
  Lock,
  Globe,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Folder,
  File
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const API_KEY = process.env.REACT_APP_API_KEY || 'supersecret';

const SolidPodsPage = () => {
  const { user, sessionToken } = useAuth();
  const [pods, setPods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPod, setSelectedPod] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadContainer, setUploadContainer] = useState('public');
  const [systemStatus, setSystemStatus] = useState(null);

  const [createForm, setCreateForm] = useState({
    username: '',
    name: '',
    description: ''
  });

  const [uploadFile, setUploadFile] = useState(null);
  const [uploadProgress, setUploadProgress] = useState(null);

  useEffect(() => {
    if (user) {
      loadSystemStatus();
      loadPods();
    }
  }, [user]);

  const loadSystemStatus = async () => {
    try {
      const response = await axios.get(`${API_URL}/solid/status`, {
        headers: { 
          'x-api-key': API_KEY,
          'x-session-token': sessionToken
        }
      });
      setSystemStatus(response.data);
    } catch (error) {
      console.error('Error loading Solid status:', error);
    }
  };

  const loadPods = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/solid/pods`, {
        headers: { 
          'x-api-key': API_KEY,
          'x-session-token': sessionToken
        }
      });
      // Filter to show only the current user's POD
      const allPods = response.data.pods || [];
      const myPods = allPods.filter(pod => pod.username === user.username);
      setPods(myPods);
    } catch (error) {
      console.error('Error loading PODs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePod = async (e) => {
    e.preventDefault();
    
    if (!user) {
      alert('You must be logged in to create a POD');
      return;
    }

    try {
      const response = await axios.post(
        `${API_URL}/solid/pods`,
        {
          username: createForm.username,
          ownerId: user.username,
          name: createForm.name || createForm.username,
          description: createForm.description
        },
        {
          headers: { 
            'x-api-key': API_KEY,
            'x-session-token': sessionToken
          }
        }
      );

      alert(`POD created successfully!\nWebID: ${response.data.pod.webId}`);
      setShowCreateModal(false);
      setCreateForm({ username: '', name: '', description: '' });
      loadPods();
    } catch (error) {
      alert(`Error creating POD: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleFileChange = (e) => {
    setUploadFile(e.target.files[0]);
  };

  const handleUploadFile = async (e) => {
    e.preventDefault();
    
    if (!uploadFile || !selectedPod) return;

    const formData = new FormData();
    formData.append('file', uploadFile);
    formData.append('userId', user.username);

    setUploadProgress('Uploading...');

    try {
      const response = await axios.post(
        `${API_URL}/solid/${selectedPod.username}/${uploadContainer}/upload`,
        formData,
        {
          headers: {
            'x-api-key': API_KEY,
            'x-session-token': sessionToken,
            'x-user-id': user.username
          }
        }
      );

      alert(`File uploaded successfully!\nCID: ${response.data.file.cid}`);
      setShowUploadModal(false);
      setUploadFile(null);
      setUploadProgress(null);
      loadPods();
    } catch (error) {
      alert(`Error uploading file: ${error.response?.data?.error || error.message}`);
      setUploadProgress(null);
    }
  };

  const handleVerifyPod = async (podId) => {
    try {
      const response = await axios.post(
        `${API_URL}/solid/pods/${podId}/verify`,
        {},
        {
          headers: { 
            'x-api-key': API_KEY,
            'x-session-token': sessionToken
          }
        }
      );

      const integrity = response.data.integrity;
      const status = integrity.valid ? '✅ Valid' : '❌ Issues found';
      
      alert(`POD Integrity Check\n\n${status}\n\nContainers:\n${
        Object.entries(integrity.checks)
          .map(([k, v]) => `${k}: ${v ? '✅' : '❌'}`)
          .join('\n')
      }`);
    } catch (error) {
      alert(`Error verifying POD: ${error.response?.data?.error || error.message}`);
    }
  };

  const handleDeletePod = async (podId) => {
    if (!window.confirm('Are you sure you want to delete this POD?')) return;

    try {
      await axios.delete(`${API_URL}/solid/pods/${podId}`, {
        headers: { 
          'x-api-key': API_KEY,
          'x-session-token': sessionToken
        }
      });

      alert('POD deleted successfully!');
      loadPods();
      setSelectedPod(null);
    } catch (error) {
      alert(`Error deleting POD: ${error.response?.data?.error || error.message}`);
    }
  };

  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900 p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-7xl mx-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white mb-2 flex items-center gap-3">
              <Box className="w-10 h-10 text-blue-400" />
              Solid PODs
            </h1>
            <p className="text-gray-400">
              Personal Online Datastores powered by IPFS
            </p>
          </div>
          
          <Button
            onClick={() => setShowCreateModal(true)}
            className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
          >
            <Plus className="w-5 h-5 mr-2" />
            Create POD
          </Button>
        </div>

        {/* System Status */}
        {systemStatus && (
          <Card className="bg-gray-800/50 border-gray-700 mb-6">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <Shield className="w-5 h-5 text-green-400" />
                    <span className="text-white font-semibold">System Status</span>
                    <Badge variant="success">Online</Badge>
                  </div>
                  <p className="text-gray-400 text-sm">
                    {systemStatus.message} • {systemStatus.system.specification}
                  </p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold text-white">
                    {systemStatus.statistics.totalPods}
                  </div>
                  <div className="text-sm text-gray-400">Total PODs</div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* PODs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {loading ? (
            <div className="col-span-3 text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto"></div>
              <p className="text-gray-400 mt-4">Loading PODs...</p>
            </div>
          ) : pods.length === 0 ? (
            <div className="col-span-3 text-center py-12">
              <Box className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400 text-lg mb-4">No PODs yet</p>
              <Button
                onClick={() => setShowCreateModal(true)}
                className="bg-blue-600 hover:bg-blue-700"
              >
                Create Your First POD
              </Button>
            </div>
          ) : (
            pods.map((pod) => (
              <motion.div
                key={pod.id}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                whileHover={{ scale: 1.02 }}
              >
                <Card className="bg-gray-800/50 border-gray-700 hover:border-blue-500 transition-all cursor-pointer">
                  <CardContent className="p-6">
                    {/* POD Header */}
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                          <Box className="w-6 h-6 text-white" />
                        </div>
                        <div>
                          <h3 className="text-white font-semibold">{pod.name}</h3>
                          <p className="text-gray-400 text-sm">@{pod.username}</p>
                        </div>
                      </div>
                      <Badge variant={pod.status === 'active' ? 'success' : 'warning'}>
                        {pod.status}
                      </Badge>
                    </div>

                    {/* Storage Info */}
                    <div className="mb-4 p-3 bg-gray-900/50 rounded-lg">
                      <div className="flex justify-between text-sm mb-2">
                        <span className="text-gray-400">Storage</span>
                        <span className="text-white font-semibold">
                          {formatBytes(pod.storage.totalBytes)}
                        </span>
                      </div>
                      <div className="flex justify-between text-sm">
                        <span className="text-gray-400">Files</span>
                        <span className="text-white font-semibold">
                          {pod.storage.fileCount}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedPod(pod);
                          setShowUploadModal(true);
                        }}
                        className="bg-blue-600 hover:bg-blue-700"
                      >
                        <Upload className="w-4 h-4 mr-1" />
                        Upload
                      </Button>
                      <Button
                        size="sm"
                        onClick={() => handleVerifyPod(pod.id)}
                        className="bg-green-600 hover:bg-green-700"
                      >
                        <CheckCircle className="w-4 h-4 mr-1" />
                        Verify
                      </Button>
                    </div>

                    {/* WebID Link */}
                    <div className="mt-4 pt-4 border-t border-gray-700">
                      <a
                        href={pod.webId}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-400 hover:text-blue-300 text-xs flex items-center gap-1"
                      >
                        <ExternalLink className="w-3 h-3" />
                        View WebID
                      </a>
                    </div>

                    {/* Delete Button */}
                    {user && pod.ownerId === user.username && (
                      <Button
                        size="sm"
                        onClick={() => handleDeletePod(pod.id)}
                        className="w-full mt-2 bg-red-600 hover:bg-red-700"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete POD
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>

      {/* Create POD Modal */}
      <AnimatePresence>
        {showCreateModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setShowCreateModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-800 rounded-xl p-6 max-w-md w-full border border-gray-700"
            >
              <h3 className="text-2xl font-bold text-white mb-6">Create New POD</h3>
              
              <form onSubmit={handleCreatePod} className="space-y-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Username *</label>
                  <Input
                    value={createForm.username}
                    onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                    placeholder="alice"
                    required
                    pattern="[a-zA-Z0-9_-]+"
                    title="Only alphanumeric characters, hyphens and underscores"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 text-sm mb-2">Display Name</label>
                  <Input
                    value={createForm.name}
                    onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                    placeholder="Alice's POD"
                  />
                </div>

                <div>
                  <label className="block text-gray-400 text-sm mb-2">Description</label>
                  <Input
                    value={createForm.description}
                    onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                    placeholder="Personal data storage"
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    type="submit"
                    className="flex-1 bg-gradient-to-r from-blue-600 to-purple-600"
                  >
                    Create POD
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="bg-gray-700 hover:bg-gray-600"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Upload File Modal */}
      <AnimatePresence>
        {showUploadModal && selectedPod && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setShowUploadModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gray-800 rounded-xl p-6 max-w-md w-full border border-gray-700"
            >
              <h3 className="text-2xl font-bold text-white mb-6">
                Upload to {selectedPod.name}
              </h3>
              
              <form onSubmit={handleUploadFile} className="space-y-4">
                <div>
                  <label className="block text-gray-400 text-sm mb-2">Container *</label>
                  <select
                    value={uploadContainer}
                    onChange={(e) => setUploadContainer(e.target.value)}
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  >
                    <option value="public">📂 Public (Everyone can read)</option>
                    <option value="private">🔒 Private (Only you)</option>
                    <option value="inbox">📥 Inbox (Messages)</option>
                    <option value="settings">⚙️ Settings</option>
                  </select>
                </div>

                <div>
                  <label className="block text-gray-400 text-sm mb-2">File *</label>
                  <input
                    type="file"
                    onChange={handleFileChange}
                    required
                    className="w-full px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white"
                  />
                </div>

                {uploadProgress && (
                  <div className="text-blue-400 text-center">{uploadProgress}</div>
                )}

                <div className="flex gap-3">
                  <Button
                    type="submit"
                    disabled={!uploadFile || uploadProgress}
                    className="flex-1 bg-blue-600 hover:bg-blue-700"
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Upload
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setShowUploadModal(false);
                      setUploadFile(null);
                      setUploadProgress(null);
                    }}
                    className="bg-gray-700 hover:bg-gray-600"
                  >
                    Cancel
                  </Button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SolidPodsPage;
