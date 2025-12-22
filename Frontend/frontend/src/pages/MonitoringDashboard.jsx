import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  AlertTriangle,
  CheckCircle,
  Server,
  HardDrive,
  TrendingUp,
  RefreshCw,
  Zap,
  Shield,
  Clock,
  Database,
  Network
} from 'lucide-react';
import { Card, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const API_KEY = process.env.REACT_APP_API_KEY || 'supersecret';

const MonitoringDashboard = () => {
  const [systemStatus, setSystemStatus] = useState(null);
  const [peerHealth, setPeerHealth] = useState({});
  const [failoverEvents, setFailoverEvents] = useState([]);
  const [integrityReport, setIntegrityReport] = useState(null);
  const [ethereumStatus, setEthereumStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedTab, setSelectedTab] = useState('overview');

  useEffect(() => {
    loadDashboardData();
    const interval = setInterval(loadDashboardData, 10000); // Refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const loadDashboardData = async () => {
    try {
      setRefreshing(true);
      
      // Parallel requests
      const [
        failoverRes,
        integrityRes,
        ethereumRes
      ] = await Promise.all([
        axios.get(`${API_URL}/failover/status`, {
          headers: { 'x-api-key': API_KEY }
        }).catch(e => ({ data: null })),
        axios.get(`${API_URL}/integrity/report`, {
          headers: { 'x-api-key': API_KEY }
        }).catch(e => ({ data: null })),
        axios.get(`${API_URL}/ethereum/status`, {
          headers: { 'x-api-key': API_KEY }
        }).catch(e => ({ data: null }))
      ]);

      if (failoverRes.data) {
        setSystemStatus(failoverRes.data.failoverSystem);
        setPeerHealth(failoverRes.data.peerHealth || {});
      }

      if (integrityRes.data?.report) {
        setIntegrityReport(integrityRes.data.report);
      }

      if (ethereumRes.data?.ethereum) {
        setEthereumStatus(ethereumRes.data.ethereum);
      }

      setLoading(false);
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const getHealthStats = () => {
    const peers = Object.values(peerHealth);
    const healthy = peers.filter(p => p.healthy).length;
    const total = peers.length;
    return { healthy, total };
  };

  const StatBox = ({ icon: Icon, label, value, status, tooltip }) => (
    <motion.div
      whileHover={{ y: -5 }}
      className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`p-2 rounded-lg ${
            status === 'healthy' ? 'bg-green-100' :
            status === 'warning' ? 'bg-yellow-100' :
            'bg-red-100'
          }`}>
            <Icon className={`w-5 h-5 ${
              status === 'healthy' ? 'text-green-600' :
              status === 'warning' ? 'text-yellow-600' :
              'text-red-600'
            }`} />
          </div>
          <div>
            <p className="text-sm text-gray-600">{label}</p>
            <p className="text-2xl font-bold">{value}</p>
          </div>
        </div>
      </div>
    </motion.div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="text-center">
          <RefreshCw className="w-12 h-12 animate-spin mx-auto mb-4" />
          <p>Loading dashboard...</p>
        </div>
      </div>
    );
  }

  const { healthy, total } = getHealthStats();
  const healthyPercentage = total > 0 ? Math.round((healthy / total) * 100) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">System Monitoring</h1>
            <p className="text-gray-600 mt-2">Real-time cluster health & integrity</p>
          </div>
          <motion.button
            whileHover={{ rotate: 180 }}
            transition={{ duration: 0.3 }}
            onClick={loadDashboardData}
            disabled={refreshing}
            className="p-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            <RefreshCw className={`w-5 h-5 ${refreshing ? 'animate-spin' : ''}`} />
          </motion.button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6 bg-white p-2 rounded-lg w-fit">
        {['overview', 'peers', 'integrity', 'ethereum'].map(tab => (
          <button
            key={tab}
            onClick={() => setSelectedTab(tab)}
            className={`px-4 py-2 rounded font-medium capitalize transition ${
              selectedTab === tab
                ? 'bg-blue-500 text-white'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {selectedTab === 'overview' && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8"
        >
          <StatBox
            icon={Server}
            label="Peer Health"
            value={`${healthy}/${total}`}
            status={healthyPercentage >= 75 ? 'healthy' : 'warning'}
            tooltip={`${healthyPercentage}% healthy`}
          />
          <StatBox
            icon={Activity}
            label="System Status"
            value={systemStatus?.monitoringActive ? 'Active' : 'Inactive'}
            status={systemStatus?.monitoringActive ? 'healthy' : 'warning'}
          />
          <StatBox
            icon={Shield}
            label="Integrity Checks"
            value={integrityReport?.healthy ? '✓ Healthy' : '⚠ Issues'}
            status={integrityReport?.healthy ? 'healthy' : 'warning'}
          />
          <StatBox
            icon={Zap}
            label="Smart Contracts"
            value={ethereumStatus?.deployed ? 'Deployed' : 'Pending'}
            status={ethereumStatus?.deployed ? 'healthy' : 'warning'}
          />
        </motion.div>
      )}

      {/* Peers Tab */}
      {selectedTab === 'peers' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-bold mb-4">Peer Health Status</h2>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {Object.entries(peerHealth).length > 0 ? (
                  Object.entries(peerHealth).map(([peerId, status]) => (
                    <motion.div
                      key={peerId}
                      whileHover={{ x: 5 }}
                      className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${
                          status.healthy ? 'bg-green-500' : 'bg-red-500'
                        }`} />
                        <div>
                          <p className="font-medium text-sm">{peerId.substring(0, 12)}...</p>
                          <p className="text-xs text-gray-500">{status.address}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <Badge variant={status.healthy ? 'success' : 'error'}>
                          {status.healthy ? 'Healthy' : 'Offline'}
                        </Badge>
                        <p className="text-xs text-gray-500 mt-1">
                          {status.responseTime ? `${status.responseTime}ms` : 'N/A'}
                        </p>
                      </div>
                    </motion.div>
                  ))
                ) : (
                  <p className="text-gray-500 text-center py-8">No peer data available</p>
                )}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Integrity Tab */}
      {selectedTab === 'integrity' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-bold mb-4">Data Integrity Report</h2>
              {integrityReport ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="w-5 h-5 text-green-600" />
                      <span className="font-medium">Overall Status</span>
                    </div>
                    <Badge variant={integrityReport.healthy ? 'success' : 'error'}>
                      {integrityReport.healthy ? 'Healthy' : 'Issues Found'}
                    </Badge>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-gray-600">Total Files</p>
                      <p className="text-2xl font-bold">{integrityReport.totalFiles}</p>
                    </div>
                    <div className="p-3 bg-green-50 rounded-lg">
                      <p className="text-sm text-gray-600">Verified</p>
                      <p className="text-2xl font-bold">{integrityReport.verifiedFiles}</p>
                    </div>
                    <div className="p-3 bg-yellow-50 rounded-lg">
                      <p className="text-sm text-gray-600">Issues</p>
                      <p className="text-2xl font-bold">{integrityReport.issues?.length || 0}</p>
                    </div>
                  </div>

                  {integrityReport.issues && integrityReport.issues.length > 0 && (
                    <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
                      <h3 className="font-medium text-sm mb-2 flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        Issues Found
                      </h3>
                      <ul className="text-sm space-y-1">
                        {integrityReport.issues.slice(0, 5).map((issue, i) => (
                          <li key={i} className="text-gray-700">
                            • {issue.issue}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <p className="text-xs text-gray-500">
                    Last check: {new Date(integrityReport.timestamp).toLocaleString()}
                  </p>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">No integrity report available</p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Ethereum Tab */}
      {selectedTab === 'ethereum' && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Card>
            <CardContent className="p-6">
              <h2 className="text-xl font-bold mb-4">Smart Contracts</h2>
              {ethereumStatus ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-3 bg-blue-50 rounded-lg">
                      <p className="text-sm text-gray-600">Network</p>
                      <p className="font-medium">{ethereumStatus.network}</p>
                    </div>
                    <div className="p-3 bg-purple-50 rounded-lg">
                      <p className="text-sm text-gray-600">Contracts</p>
                      <p className="font-medium">{Object.keys(ethereumStatus.contracts).length}</p>
                    </div>
                  </div>

                  {ethereumStatus.contracts && Object.entries(ethereumStatus.contracts).map(([name, contract]) => (
                    <div key={name} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                      <p className="font-medium text-sm mb-2">{contract.name}</p>
                      <p className="text-xs text-gray-600 font-mono truncate">
                        {contract.address}
                      </p>
                      <p className="text-xs text-gray-500 mt-1">
                        Deployed: {new Date(contract.deployedAt).toLocaleDateString()}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-gray-500 text-center py-8">Ethereum integration not available</p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </div>
  );
};

export default MonitoringDashboard;
