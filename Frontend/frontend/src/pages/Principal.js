import React, { useState } from 'react';
import Header from '../components/Header';
import ConfigPanel from '../components/ConfigPanel';
import InfoPanel from '../components/InfoPanel';
import PeersPanel from '../components/PeersPanel';
import LogsPanel from '../components/LogsPanel';
import { configureNetwork, getPeers } from '../api/ipfsApi';
import { useLogs } from '../hooks/useLogs';
import { Server, RefreshCw, Users } from 'lucide-react';
import '../App.css';

export default function Principal() {
  const [swarmKey, setSwarmKey] = useState('ddd244b4b304dca4d8947b4444a1d76223334cfdafd674263b0b600feae39cbe');
  const [bootstrapNode, setBootstrapNode] = useState('/ip4/192.168.1.104/tcp/4001/p2p/12D3KooWQWwEb4DrNcW85vsp5brhxQaRk6bennUHYqMbMVDnABXV');
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [peers, setPeers] = useState([]);
  const { logs, addLog, clearLogs } = useLogs();

  const handleConfigureNetwork = async () => {
    setIsConfiguring(true);
    clearLogs();
    try {
      const res = await configureNetwork(swarmKey, bootstrapNode);
      res.data.logs.forEach((log) => addLog(log.message, log.type));
    } catch (err) {
      addLog(`Eroare: ${err.message}`, 'error');
    } finally {
      setIsConfiguring(false);
    }
  };

  const loadPeers = async () => {
    try {
      const res = await getPeers();
      setPeers(res.data.peers);
      addLog(`✓ ${res.data.peers.length} peers conectați`, 'success');
    } catch (err) {
      addLog(`Eroare la peers: ${err.message}`, 'error');
    }
  };

  const copySwarmKey = () => {
    const keyContent = `/key/swarm/psk/1.0.0/\n/base16/\n${swarmKey}`;
    navigator.clipboard.writeText(keyContent);
    addLog('Swarm key copiat în clipboard', 'success');
  };

  return (
    <div className="app-container">
      <Header />

      <div className="grid-2">
        <ConfigPanel
          swarmKey={swarmKey}
          setSwarmKey={setSwarmKey}
          bootstrapNode={bootstrapNode}
          setBootstrapNode={setBootstrapNode}
          onCopy={copySwarmKey}
        />
        <InfoPanel />
      </div>

      <div className="grid-2">
        <button
          onClick={handleConfigureNetwork}
          disabled={isConfiguring}
          className="btn btn-primary"
        >
          {isConfiguring ? (
            <>
              <RefreshCw className="spinning" />
              Se configurează...
            </>
          ) : (
            <>
              <Server /> Configurează Rețeaua Privată
            </>
          )}
        </button>

        <button onClick={loadPeers} className="btn btn-info">
          <Users /> Verifică Peers Conectați
        </button>
      </div>

      {peers.length > 0 && <PeersPanel peers={peers} />}
      {logs.length > 0 && <LogsPanel logs={logs} />}
    </div>
  );
}
