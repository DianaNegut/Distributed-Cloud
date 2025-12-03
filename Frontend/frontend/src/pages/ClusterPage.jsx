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
  FileText
} from 'lucide-react';
import axios from 'axios';
import toast, { Toaster } from 'react-hot-toast';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const API_KEY = process.env.REACT_APP_API_KEY || 'supersecret';

export default function ClusterPage() {
  const [clusterInfo, setClusterInfo] = useState(null);
  const [loading, setLoading] = useState(false);
  const [peers, setPeers] = useState([]);

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
        
        const peersList = response.data.cluster.peersList || [];
        setPeers(Array.isArray(peersList) ? peersList : []);
      }
    } catch (error) {
      console.error('Error loading cluster:', error);
      setPeers([]);
    }
  };

  const handleRefresh = async () => {
    setLoading(true);
    await loadClusterInfo();
    setLoading(false);
    toast.success('Cluster info refreshed');
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
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

        {/* Cluster Peers */}
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
      </div>
    </div>
  );
}
