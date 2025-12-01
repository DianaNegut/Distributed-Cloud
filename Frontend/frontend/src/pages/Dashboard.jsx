import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  Activity, 
  HardDrive, 
  Users, 
  Zap, 
  TrendingUp,
  Server,
  Database,
  Cloud
} from 'lucide-react';
import { StatCard } from '../components/ui/StatCard';
import { Card, CardContent } from '../components/ui/Card';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const API_KEY = process.env.REACT_APP_API_KEY || 'supersecret';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalFiles: 0,
    totalPeers: 0,
    networkStatus: 'checking',
    clusterNodes: 0
  });

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load files
      const filesRes = await axios.get(`${API_URL}/files/list`, {
        headers: { 'x-api-key': API_KEY }
      });

      // Load peers
      const peersRes = await axios.get(`${API_URL}/peers`, {
        headers: { 'x-api-key': API_KEY }
      });

      // Load cluster status
      const clusterRes = await axios.get(`${API_URL}/docker-cluster/status`, {
        headers: { 'x-api-key': API_KEY }
      }).catch(() => ({ data: { nodes: [] } }));

      setStats({
        totalFiles: filesRes.data?.totalFiles || 0,
        totalPeers: peersRes.data?.peers?.length || 0,
        networkStatus: 'active',
        clusterNodes: clusterRes.data?.nodes?.filter(n => n.running)?.length || 0
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-7xl mx-auto p-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-white mb-2">Dashboard</h1>
          <p className="text-gray-400">Monitorizeaza si gestioneaza reteaua ta IPFS distribuita</p>
        </motion.div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Fisiere in IPFS"
          value={stats.totalFiles}
          icon={HardDrive}
          trend={12}
          color="primary"
        />
        <StatCard
          title="Peers Conectati"
          value={stats.totalPeers}
          icon={Users}
          trend={8}
          color="success"
        />
        <StatCard
          title="Noduri Cluster"
          value={stats.clusterNodes}
          icon={Server}
          color="warning"
        />
        <StatCard
          title="Status Retea"
          value={stats.networkStatus === 'active' ? 'Activ' : 'Inactiv'}
          icon={Activity}
          color={stats.networkStatus === 'active' ? 'success' : 'danger'}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Network Health */}
        <Card>
          <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Activity className="w-6 h-6 text-primary-400" />
              Sanatate Retea
            </h2>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-sm text-green-400 font-medium">Online</span>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-dark-800/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-primary-500/20 rounded-lg flex items-center justify-center">
                  <Database className="w-5 h-5 text-primary-400" />
                </div>
                <div>
                  <p className="text-white font-medium">IPFS Node</p>
                  <p className="text-gray-400 text-sm">Configurare privata</p>
                </div>
              </div>
              <div className="w-16 h-2 bg-dark-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '85%' }}
                  transition={{ duration: 1, delay: 0.2 }}
                  className="h-full bg-gradient-to-r from-green-500 to-green-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-dark-800/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
                  <Cloud className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-white font-medium">Docker Cluster</p>
                  <p className="text-gray-400 text-sm">{stats.clusterNodes} noduri active</p>
                </div>
              </div>
              <div className="w-16 h-2 bg-dark-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '70%' }}
                  transition={{ duration: 1, delay: 0.4 }}
                  className="h-full bg-gradient-to-r from-blue-500 to-blue-400"
                />
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-dark-800/50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-purple-500/20 rounded-lg flex items-center justify-center">
                  <Zap className="w-5 h-5 text-purple-400" />
                </div>
                <div>
                  <p className="text-white font-medium">Performanta</p>
                  <p className="text-gray-400 text-sm">Optima</p>
                </div>
              </div>
              <div className="w-16 h-2 bg-dark-700 rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: '92%' }}
                  transition={{ duration: 1, delay: 0.6 }}
                  className="h-full bg-gradient-to-r from-purple-500 to-purple-400"
                />
              </div>
            </div>
          </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardContent className="pt-6">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Zap className="w-6 h-6 text-yellow-400" />
            Actiuni Rapide
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <motion.a
              href="/files"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-4 bg-gradient-to-br from-primary-600 to-primary-500 rounded-xl text-white text-center shadow-lg shadow-primary-500/30 cursor-pointer"
            >
              <HardDrive className="w-8 h-8 mx-auto mb-2" />
              <p className="font-medium">Incarca Fisier</p>
            </motion.a>

            <motion.a
              href="/network"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-4 bg-gradient-to-br from-green-600 to-green-500 rounded-xl text-white text-center shadow-lg shadow-green-500/30 cursor-pointer"
            >
              <Users className="w-8 h-8 mx-auto mb-2" />
              <p className="font-medium">Vezi Peers</p>
            </motion.a>

            <motion.a
              href="/cluster"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-4 bg-gradient-to-br from-purple-600 to-purple-500 rounded-xl text-white text-center shadow-lg shadow-purple-500/30 cursor-pointer"
            >
              <Server className="w-8 h-8 mx-auto mb-2" />
              <p className="font-medium">Gestioneaza Cluster</p>
            </motion.a>

            <motion.a
              href="/activity"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-4 bg-gradient-to-br from-orange-600 to-orange-500 rounded-xl text-white text-center shadow-lg shadow-orange-500/30 cursor-pointer"
            >
              <TrendingUp className="w-8 h-8 mx-auto mb-2" />
              <p className="font-medium">Vezi Activitate</p>
            </motion.a>
          </div>
          </CardContent>
        </Card>
      </div>

      {/* Storage Overview */}
      <Card>
        <CardContent className="pt-6">
        <h2 className="text-xl font-bold text-white mb-6">Statistici Stocare</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center">
            <div className="text-4xl font-bold text-primary-400 mb-2">{stats.totalFiles}</div>
            <p className="text-gray-400">Fisiere totale</p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-green-400 mb-2">{(stats.totalFiles * 2.5).toFixed(1)} MB</div>
            <p className="text-gray-400">Spatiu utilizat (estimat)</p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-purple-400 mb-2">{stats.totalPeers + stats.clusterNodes}</div>
            <p className="text-gray-400">Noduri total in retea</p>
          </div>
        </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
};

export default Dashboard;
