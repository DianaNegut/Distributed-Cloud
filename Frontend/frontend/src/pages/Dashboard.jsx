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
  Cloud,
  AlertTriangle,
  ShoppingCart
} from 'lucide-react';
import { StatCard } from '../components/ui/StatCard';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const API_KEY = process.env.REACT_APP_API_KEY || 'supersecret';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalFiles: 0,
    totalPeers: 0,
    networkStatus: 'checking',
    clusterNodes: 0,
    totalProviders: 0,
    activeContracts: 0,
    totalStorageGB: 0,
    availableStorageGB: 0
  });
  const [myPeerId, setMyPeerId] = useState('');
  const [userStorage, setUserStorage] = useState(null);

  useEffect(() => {
    loadMyPeerId();
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 10000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (myPeerId) {
      loadUserStorage();
    }
  }, [myPeerId]);

  const loadMyPeerId = async () => {
    try {
      const response = await axios.get(`${API_URL}/status`, {
        headers: { 'x-api-key': API_KEY }
      });
      const peerId = response.data?.data?.ID || response.data?.id || response.data?.peerId || 'default-user';
      setMyPeerId(peerId);
    } catch (error) {
      console.error('Error loading peer ID:', error);
      setMyPeerId('default-user');
    }
  };

  const loadUserStorage = async () => {
    if (!myPeerId) return;
    try {
      const response = await axios.get(`${API_URL}/user-storage/${myPeerId}`, {
        headers: { 'x-api-key': API_KEY }
      });
      if (response.data.success) {
        setUserStorage(response.data);
      }
    } catch (error) {
      console.error('Error loading user storage:', error);
    }
  };

  const loadDashboardData = async () => {
    try {
      const filesRes = await axios.get(`${API_URL}/files/list`, {
        headers: { 'x-api-key': API_KEY }
      });

      const peersRes = await axios.get(`${API_URL}/peers`, {
        headers: { 'x-api-key': API_KEY }
      });

      const clusterRes = await axios.get(`${API_URL}/docker-cluster/status`, {
        headers: { 'x-api-key': API_KEY }
      }).catch(() => ({ data: { success: false, cluster: { totalNodes: 0 } } }));

      const providersRes = await axios.get(`${API_URL}/storage-providers`, {
        headers: { 'x-api-key': API_KEY }
      }).catch(() => ({ data: { providers: [] } }));

      const contractsRes = await axios.get(`${API_URL}/storage-contracts`, {
        headers: { 'x-api-key': API_KEY }
      }).catch(() => ({ data: { contracts: [] } }));

      const providers = providersRes.data?.providers || [];
      const contracts = contractsRes.data?.contracts || [];
      
      const totalStorage = providers.reduce((sum, p) => sum + p.capacity.totalGB, 0);
      const availableStorage = providers.reduce((sum, p) => sum + p.capacity.availableGB, 0);
      const activeContracts = contracts.filter(c => c.status === 'active').length;

      // Verifică dacă rețeaua este activă
      const totalPeers = peersRes.data?.peers?.length || 0;
      const clusterNodesCount = clusterRes.data?.cluster?.totalNodes || 0;
      const isNetworkActive = (totalPeers > 0 || clusterNodesCount > 0) && clusterRes.data?.success !== false;

      setStats({
        totalFiles: filesRes.data?.totalFiles || 0,
        totalPeers: totalPeers,
        networkStatus: isNetworkActive ? 'active' : 'offline',
        clusterNodes: clusterNodesCount,
        totalProviders: providers.length,
        activeContracts: activeContracts,
        totalStorageGB: totalStorage,
        availableStorageGB: availableStorage
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
    }
  };

  return (
    <div className="flex-1 overflow-auto">
      <div className="max-w-7xl mx-auto p-8">
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <h1 className="text-4xl font-bold text-white mb-2">Panou Principal</h1>
          <p className="text-gray-400">Monitorizează și gestionează rețeaua ta IPFS distribuită</p>
        </motion.div>

      {/* User Storage Card */}
      {userStorage && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <Card className={`border-l-4 ${
            userStorage.status === 'critical' ? 'border-l-red-500' :
            userStorage.status === 'warning' ? 'border-l-yellow-500' :
            'border-l-green-500'
          }`}>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center justify-between flex-wrap gap-4">
                <div className="flex items-center gap-4">
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                    userStorage.status === 'critical' ? 'bg-red-500/20' :
                    userStorage.status === 'warning' ? 'bg-yellow-500/20' :
                    'bg-green-500/20'
                  }`}>
                    <HardDrive className={`w-6 h-6 ${
                      userStorage.status === 'critical' ? 'text-red-400' :
                      userStorage.status === 'warning' ? 'text-yellow-400' :
                      'text-green-400'
                    }`} />
                  </div>
                  <div>
                    <p className="text-white font-medium">
                      Stocare Personală: {userStorage.storage.usedGB} GB / {userStorage.storage.limitGB} GB
                    </p>
                    <p className="text-gray-400 text-sm">
                      {userStorage.storage.remainingGB} GB disponibili • {userStorage.storage.filesCount} fișiere
                      {userStorage.storage.isDefault && ' • Plan Gratuit (1 GB)'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <div className="w-48">
                    <div className="flex justify-between text-xs mb-1">
                      <span className="text-gray-400">Utilizare</span>
                      <span className={`font-medium ${
                        userStorage.storage.usagePercent >= 95 ? 'text-red-400' :
                        userStorage.storage.usagePercent >= 80 ? 'text-yellow-400' :
                        'text-green-400'
                      }`}>{userStorage.storage.usagePercent}%</span>
                    </div>
                    <div className="w-full bg-dark-700 rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${
                          userStorage.storage.usagePercent >= 95 ? 'bg-red-500' :
                          userStorage.storage.usagePercent >= 80 ? 'bg-yellow-500' :
                          'bg-green-500'
                        }`}
                        style={{ width: `${Math.min(userStorage.storage.usagePercent, 100)}%` }}
                      />
                    </div>
                  </div>
                  
                  {userStorage.storage.isDefault && (
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

              {userStorage.warning && (
                <div className={`mt-3 p-3 rounded-lg flex items-center gap-2 ${
                  userStorage.status === 'critical' ? 'bg-red-500/10 text-red-400' :
                  'bg-yellow-500/10 text-yellow-400'
                }`}>
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <p className="text-sm">{userStorage.warning}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Fișiere în IPFS"
          value={stats.totalFiles}
          icon={HardDrive}
          trend={12}
          color="primary"
        />
        <StatCard
          title="Peers Conectați"
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
          title="Status Rețea"
          value={stats.networkStatus === 'active' ? 'Activ' : 'Inactiv'}
          icon={Activity}
          color={stats.networkStatus === 'active' ? 'success' : 'danger'}
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mt-6">
        <StatCard
          title="Provideri Activi"
          value={stats.totalProviders}
          icon={Database}
          color="info"
        />
        <StatCard
          title="Contracte Active"
          value={stats.activeContracts}
          icon={TrendingUp}
          color="success"
        />
        <StatCard
          title="Stocare Marketplace"
          value={`${stats.totalStorageGB.toFixed(0)} GB`}
          subtitle="Oferită de provideri"
          icon={HardDrive}
          color="primary"
        />
        <StatCard
          title="Disponibil în Piață"
          value={`${stats.availableStorageGB.toFixed(0)} GB`}
          subtitle="De cumpărat"
          icon={Cloud}
          color="warning"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        <Card>
          <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Activity className="w-6 h-6 text-primary-400" />
              Sănătate Rețea
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
                  <p className="text-white font-medium">Nod IPFS</p>
                  <p className="text-gray-400 text-sm">Configurare privată</p>
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
                  <p className="text-white font-medium">Cluster Docker</p>
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
                  <p className="text-white font-medium">Performanță</p>
                  <p className="text-gray-400 text-sm">Optimă</p>
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

        <Card>
          <CardContent className="pt-6">
          <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
            <Zap className="w-6 h-6 text-yellow-400" />
            Acțiuni Rapide
          </h2>

          <div className="grid grid-cols-3 gap-4">
            <motion.a
              href="/files"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="p-4 bg-gradient-to-br from-primary-600 to-primary-500 rounded-xl text-white text-center shadow-lg shadow-primary-500/30 cursor-pointer"
            >
              <HardDrive className="w-8 h-8 mx-auto mb-2" />
              <p className="font-medium">Încarcă Fișier</p>
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
              <p className="font-medium">Gestionează Cluster</p>
            </motion.a>
          </div>
          </CardContent>
        </Card>
      </div>

      {/* Storage Overview */}
      <Card>
        <CardContent className="pt-6">
        <h2 className="text-xl font-bold text-white mb-6">Statistici Stocare</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="text-4xl font-bold text-primary-400 mb-2">{stats.totalFiles}</div>
            <p className="text-gray-400">Fișiere totale</p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-green-400 mb-2">{(stats.totalFiles * 2.5).toFixed(1)} MB</div>
            <p className="text-gray-400">Spațiu utilizat (estimat)</p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-purple-400 mb-2">{stats.totalPeers + stats.clusterNodes}</div>
            <p className="text-gray-400">Noduri total în rețea</p>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold text-blue-400 mb-2">
              {stats.totalStorageGB > 0 ? ((stats.totalStorageGB - stats.availableStorageGB) / stats.totalStorageGB * 100).toFixed(1) : 0}%
            </div>
            <p className="text-gray-400">Utilizare piață</p>
          </div>
        </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
};

export default Dashboard;
