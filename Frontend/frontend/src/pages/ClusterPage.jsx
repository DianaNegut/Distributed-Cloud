import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { 
  Box, 
  RefreshCw,
  Container,
  CheckCircle,
  Activity,
  Users,
  FileText,
  Upload
} from 'lucide-react';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const API_KEY = process.env.REACT_APP_API_KEY || 'supersecret';

export default function ClusterPage() {
  const [clusterInfo, setClusterInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [peers, setPeers] = useState([]);
  const [pins, setPins] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = React.useRef(null);

  useEffect(() => {
    loadClusterInfo();
    const interval = setInterval(loadClusterInfo, 5000);
    return () => clearInterval(interval);
  }, []);

  const loadClusterInfo = async () => {
    try {
      const response = await axios.get(`${API_URL}/docker-cluster/status`, {
        headers: { 'x-api-key': API_KEY }
      });

      console.log('Cluster status response:', response.data);

      if (response.data.success && response.data.cluster) {
        setClusterInfo(response.data.cluster);
        
        // Asigură-te că peers este array
        const peersList = response.data.cluster.peersList || [];
        setPeers(Array.isArray(peersList) ? peersList : []);
        
        // Convertește pins din obiect în array dacă e nevoie
        const pinsList = response.data.cluster.pinsList || [];
        console.log('Pins list received:', pinsList);
        console.log('Pins list type:', typeof pinsList);
        console.log('Pins list is array:', Array.isArray(pinsList));
        console.log('Pins list length:', Array.isArray(pinsList) ? pinsList.length : 'N/A');
        
        if (Array.isArray(pinsList)) {
          console.log('Setting pins array:', pinsList);
          setPins(pinsList);
        } else if (typeof pinsList === 'object' && pinsList !== null) {
          // Convertește obiectul în array
          const pinsArray = Object.values(pinsList);
          console.log('Converting object to array:', pinsArray);
          setPins(pinsArray);
        } else {
          console.log('No valid pins data, setting empty array');
          setPins([]);
        }
      }
    } catch (error) {
      console.error('Error loading cluster:', error);
      setPeers([]);
      setPins([]);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    await loadClusterInfo();
    setLoading(false);
    toast.success('Cluster info refreshed');
  };

  const handleFileSelect = (e) => {
    if (e.target.files && e.target.files[0]) {
      setSelectedFile(e.target.files[0]);
      toast.success(`File selected: ${e.target.files[0].name}`);
    }
  };

  const handleUploadToCluster = async () => {
    if (!selectedFile) {
      toast.error('Please select a file first');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);

    console.log('Uploading file to cluster:', selectedFile.name);
    console.log('FormData entries:', Array.from(formData.entries()));

    try {
      toast.loading('Uploading to cluster...');
      
      const response = await axios.post(`${API_URL}/docker-cluster/add`, formData, {
        headers: { 
          'x-api-key': API_KEY
        }
      });

      toast.dismiss();
      console.log('Cluster upload response:', response.data);

      if (response.data.success) {
        toast.success(`File uploaded to cluster! CID: ${response.data.cid || response.data.file?.cid}`);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        await loadClusterInfo();
      } else {
        toast.error('Upload failed: ' + (response.data.error || 'Unknown error'));
      }
    } catch (error) {
      toast.dismiss();
      console.error('Upload error:', error);
      console.error('Error response:', error.response?.data);
      toast.error('Upload to cluster failed: ' + (error.response?.data?.error || error.message));
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      <Toaster position="top-right" />
      
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-white mb-2">Docker Cluster</h1>
          <p className="text-gray-400">Manage your IPFS Docker cluster nodes</p>
        </motion.div>

        {/* Cluster Info Panel */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle icon={Box}>IPFS Cluster Information</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded-full ${clusterInfo ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
                  <span className="text-gray-400">
                    Status: <span className="text-white font-medium">{clusterInfo ? 'Online' : 'Offline'}</span>
                  </span>
                </div>
                {clusterInfo && (
                  <>
                    <div className="text-gray-400">
                      Nodes: <span className="text-white font-medium">{clusterInfo.totalNodes || 0}</span>
                    </div>
                    <div className="text-gray-400">
                      Peers: <span className="text-white font-medium">{clusterInfo.peers || 0}</span>
                    </div>
                    <div className="text-gray-400">
                      Pinned Files: <span className="text-white font-medium">{clusterInfo.pinnedFiles || 0}</span>
                    </div>
                  </>
                )}
              </div>
              
              <Button
                onClick={handleRefresh}
                loading={loading}
                variant="ghost"
                icon={RefreshCw}
              >
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Cluster Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6">
          <Card hover={false}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-primary-600 to-primary-500 rounded-xl flex items-center justify-center">
                  <Container className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Total Nodes</p>
                  <p className="text-2xl font-bold text-white">{clusterInfo?.totalNodes || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card hover={false}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-green-600 to-green-500 rounded-xl flex items-center justify-center">
                  <CheckCircle className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Connected Peers</p>
                  <p className="text-2xl font-bold text-white">{clusterInfo?.peers || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card hover={false}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-blue-600 to-blue-500 rounded-xl flex items-center justify-center">
                  <Activity className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Pinned Files</p>
                  <p className="text-2xl font-bold text-white">{clusterInfo?.pinnedFiles || 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card hover={false}>
            <CardContent className="pt-6">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-gradient-to-br from-purple-600 to-purple-500 rounded-xl flex items-center justify-center">
                  <Box className="w-6 h-6 text-white" />
                </div>
                <div>
                  <p className="text-gray-400 text-sm">Cluster Health</p>
                  <p className="text-2xl font-bold text-white">{clusterInfo ? '100%' : 'N/A'}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Upload to Cluster */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle icon={Upload}>Upload File to Cluster</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4">
              <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                className="flex-1 px-4 py-2 bg-dark-800 border border-dark-600 rounded-xl text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-primary-600 file:text-white hover:file:bg-primary-500"
              />
              <Button
                onClick={handleUploadToCluster}
                loading={uploading}
                disabled={!selectedFile}
                icon={Upload}
                variant="success"
              >
                Upload to Cluster
              </Button>
            </div>
            {selectedFile && (
              <p className="text-gray-400 text-sm mt-2">
                Selected: {selectedFile.name} ({(selectedFile.size / 1024 / 1024).toFixed(2)} MB)
              </p>
            )}
          </CardContent>
        </Card>

        {/* Cluster Peers and Pins */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Peers List */}
          <Card>
            <CardHeader>
              <CardTitle icon={Users}>Cluster Peers</CardTitle>
            </CardHeader>
            <CardContent>
              {peers.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {peers.map((peer, index) => (
                    <motion.div
                      key={peer.id || index}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.05 }}
                      className="flex items-center gap-3 p-3 bg-dark-800 rounded-lg"
                    >
                      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse flex-shrink-0"></div>
                      <div className="flex-1 min-w-0">
                        <p className="text-white text-sm font-medium truncate">{peer.peername || 'Unknown'}</p>
                        <p className="text-gray-400 text-xs font-mono truncate">{peer.id || peer}</p>
                      </div>
                      <Badge variant="success">Active</Badge>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-500">No peers connected</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pinned Files */}
          <Card>
            <CardHeader>
              <CardTitle icon={FileText}>Pinned Files in Cluster</CardTitle>
            </CardHeader>
            <CardContent>
              {pins.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {pins.map((pin, index) => {
                    const cid = pin.cid || pin;
                    
                    const handleOpenFile = async (e) => {
                      e.stopPropagation();
                      
                      console.log('Opening file with CID:', cid);
                      console.log('Full pin object:', pin);
                      
                      // Folosește endpoint-ul de proxy din backend
                      const proxyUrl = `${API_URL}/docker-cluster/file/${cid}`;
                      
                      console.log('Opening file through proxy:', proxyUrl);
                      
                      // Deschide fișierul prin backend proxy
                      window.open(proxyUrl + `?api-key=${API_KEY}`, '_blank');
                    };
                    
                    return (
                      <motion.div
                        key={cid || index}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex items-center gap-3 p-3 bg-dark-800 rounded-lg hover:bg-dark-700 transition-colors"
                      >
                        <FileText className="w-5 h-5 text-primary-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">{pin.name || 'File'}</p>
                          <p className="text-gray-400 text-xs font-mono truncate">{cid}</p>
                        </div>
                        <Button
                          onClick={handleOpenFile}
                          size="sm"
                          variant="primary"
                          className="text-xs px-3 py-1"
                        >
                          Open
                        </Button>
                        <Badge variant="info">Pinned</Badge>
                      </motion.div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <FileText className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                  <p className="text-gray-500">No files pinned in cluster</p>
                  <p className="text-gray-600 text-sm mt-2">Upload files to see them here</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
