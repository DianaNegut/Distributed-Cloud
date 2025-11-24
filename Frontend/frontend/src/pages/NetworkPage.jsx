import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input, TextArea } from '../components/ui/Input';
import { Badge } from '../components/ui/Badge';
import { 
  Network as NetworkIcon, 
  Key, 
  Server, 
  RefreshCw,
  Users,
  CheckCircle,
  AlertCircle,
  Copy,
  Settings,
  Activity
} from 'lucide-react';
import { configureNetwork, getPeers, getNetworkInfo } from '../api/ipfsApi';
import toast, { Toaster } from 'react-hot-toast';

export default function NetworkPage() {
  const [swarmKey, setSwarmKey] = useState('ddd244b4b304dca4d8947b4444a1d76223334cfdafd674263b0b600feae39cbe');
  const [bootstrapNode, setBootstrapNode] = useState('/ip4/192.168.1.104/tcp/4001/p2p/12D3KooWQWwEb4DrNcW85vsp5brhxQaRk6bennUHYqMbMVDnABXV');
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [peers, setPeers] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loadingPeers, setLoadingPeers] = useState(false);
  const [networkStatus, setNetworkStatus] = useState({ active: false, checking: true });

  const addLog = (message, type) => {
    const newLog = { message, type, timestamp: new Date().toLocaleTimeString() };
    setLogs(prev => [newLog, ...prev].slice(0, 50));
    
    if (type === 'success') toast.success(message);
    else if (type === 'error') toast.error(message);
    else toast(message);
  };

  const handleConfigureNetwork = async () => {
    setIsConfiguring(true);
    setLogs([]);
    try {
      const res = await configureNetwork(swarmKey, bootstrapNode);
      if (res?.data?.logs) {
        res.data.logs.forEach((log) => addLog(log.message, log.type));
      } else {
        addLog('Network configured successfully!', 'success');
      }
    } catch (err) {
      addLog(`Error: ${err.message}`, 'error');
    } finally {
      setIsConfiguring(false);
    }
  };

  const loadPeers = async () => {
    setLoadingPeers(true);
    try {
      const res = await getPeers();
      const fetchedPeers = res?.data?.peers || [];
      setPeers(fetchedPeers);
      addLog(`✓ ${fetchedPeers.length} peers connected`, 'success');
    } catch (err) {
      addLog(`Error loading peers: ${err.message}`, 'error');
    } finally {
      setLoadingPeers(false);
    }
  };

  const copySwarmKey = () => {
    const keyContent = `/key/swarm/psk/1.0.0/\n/base16/\n${swarmKey}`;
    try {
      navigator.clipboard.writeText(keyContent);
      addLog('Swarm key copied to clipboard!', 'success');
    } catch (err) {
      addLog(`Copy error: ${err.message}`, 'error');
    }
  };

  const checkNetworkStatus = async () => {
    try {
      const res = await getNetworkInfo();
      if (res?.data?.success) {
        // Verifică dacă rețeaua privată este efectiv activă
        const isActive = res.data.network.isActive === true;
        setNetworkStatus({ active: isActive, checking: false });
        
        // Actualizează și swarm key-ul și bootstrap node-ul din răspuns
        if (res.data.network.swarmKey) {
          setSwarmKey(res.data.network.swarmKey);
        }
        if (res.data.network.bootstrapNode) {
          setBootstrapNode(res.data.network.bootstrapNode);
        }
        
        console.log('Network status:', { 
          isActive, 
          swarmKeyExists: res.data.network.status?.swarmKeyExists,
          autoConfDisabled: res.data.network.status?.autoConfDisabled
        });
      } else {
        setNetworkStatus({ active: false, checking: false });
      }
    } catch (err) {
      setNetworkStatus({ active: false, checking: false });
      console.error('Network status check failed:', err);
    }
  };

  useEffect(() => {
    // Verifică statusul la mount
    checkNetworkStatus();
    
    // Verifică statusul periodic (la fiecare 10 secunde)
    const interval = setInterval(checkNetworkStatus, 10000);
    
    return () => clearInterval(interval);
  }, []);

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
          <h1 className="text-4xl font-bold text-white mb-2">Private Network</h1>
          <p className="text-gray-400">Configure your IPFS private network settings</p>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Configuration Card */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <CardTitle icon={Settings}>Network Configuration</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <Input
                    label="Swarm Key (hex)"
                    value={swarmKey}
                    onChange={(e) => setSwarmKey(e.target.value)}
                    placeholder="Enter your swarm key"
                    icon={Key}
                    readOnly
                  />
                  
                  <TextArea
                    label="Bootstrap Node Address"
                    value={bootstrapNode}
                    onChange={(e) => setBootstrapNode(e.target.value)}
                    placeholder="/ip4/..."
                    rows={3}
                    readOnly
                  />

                  <div className="flex gap-3">
                    <Button
                      onClick={handleConfigureNetwork}
                      loading={isConfiguring}
                      icon={Server}
                      className="flex-1"
                    >
                      Configure Network
                    </Button>
                    
                    <Button
                      onClick={copySwarmKey}
                      variant="outline"
                      icon={Copy}
                    >
                      Copy Key
                    </Button>
                  </div>

                  <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                    <h3 className="text-sm font-semibold text-blue-400 mb-2">How to Connect</h3>
                    <p className="text-xs text-gray-400 mb-3">
                      Share these credentials with others who want to join your private network.
                    </p>
                    <div className="space-y-2 text-xs text-gray-300">
                      <p>1. Install IPFS (kubo) on your machine</p>
                      <p>2. Create <code className="bg-dark-800 px-1 py-0.5 rounded">~/.ipfs/swarm.key</code> with the key above</p>
                      <p>3. Run: <code className="bg-dark-800 px-1 py-0.5 rounded">ipfs bootstrap rm --all</code></p>
                      <p>4. Run: <code className="bg-dark-800 px-1 py-0.5 rounded">ipfs bootstrap add {bootstrapNode}</code></p>
                      <p>5. Start daemon: <code className="bg-dark-800 px-1 py-0.5 rounded">LIBP2P_FORCE_PNET=1 ipfs daemon</code></p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Peers Card */}
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle icon={Users}>Connected Peers</CardTitle>
                <Button
                  onClick={loadPeers}
                  loading={loadingPeers}
                  variant="ghost"
                  size="sm"
                  icon={RefreshCw}
                >
                  Refresh
                </Button>
              </CardHeader>
              <CardContent>
                {peers.length > 0 ? (
                  <div className="space-y-2">
                    {peers.map((peer, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.05 }}
                        className="flex items-center gap-3 p-3 bg-dark-800 rounded-lg"
                      >
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        <span className="text-sm text-gray-300 font-mono flex-1 truncate">{peer}</span>
                        <Badge variant="success">Active</Badge>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Users className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-500">No peers connected</p>
                    <p className="text-gray-600 text-sm mt-2">Configure the network to start connecting</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Logs & Status Sidebar */}
          <div className="space-y-6">
            {/* Network Status */}
            <Card>
              <CardHeader>
                <CardTitle icon={NetworkIcon}>Network Status</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Private Network</span>
                    {networkStatus.checking ? (
                      <Badge variant="default">Checking...</Badge>
                    ) : (
                      <Badge variant={networkStatus.active ? "success" : "error"}>
                        {networkStatus.active ? "Active" : "Inactive"}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Status</span>
                    <Badge variant={peers.length > 0 ? "success" : "default"}>
                      {peers.length > 0 ? "Online" : "Offline"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Connected Peers</span>
                    <span className="text-white font-semibold">{peers.length}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Network Type</span>
                    <Badge variant="info">Private</Badge>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Activity Logs */}
            <Card>
              <CardHeader>
                <CardTitle icon={Activity}>Activity Logs</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {logs.length > 0 ? (
                    logs.map((log, index) => (
                      <motion.div
                        key={index}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-start gap-2 p-2 bg-dark-800 rounded text-sm"
                      >
                        {log.type === 'success' && <CheckCircle className="w-4 h-4 text-green-400 flex-shrink-0 mt-0.5" />}
                        {log.type === 'error' && <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />}
                        {log.type === 'info' && <Server className="w-4 h-4 text-blue-400 flex-shrink-0 mt-0.5" />}
                        <div className="flex-1 min-w-0">
                          <p className="text-gray-300 text-xs">{log.message}</p>
                          <p className="text-gray-500 text-xs mt-0.5">{log.timestamp}</p>
                        </div>
                      </motion.div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <Server className="w-12 h-12 text-gray-600 mx-auto mb-2" />
                      <p className="text-gray-500 text-sm">No activity yet</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
