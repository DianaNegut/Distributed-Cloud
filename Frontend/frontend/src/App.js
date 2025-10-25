import React, { useState } from 'react';
import { Network, Server, Key, Shield, RefreshCw, CheckCircle, AlertCircle, Users } from 'lucide-react';
import axios from 'axios';

const API_URL = 'http://localhost:3001/api';
// MODIFICAT: Citește cheia API din environment, cu un fallback
const API_KEY = process.env.REACT_APP_API_KEY || 'supersecret';

function App() {
  const [swarmKey, setSwarmKey] = useState('ddd244b4b304dca4d8947b4444a1d76223334cfdafd674263b0b600feae39cbe');
  const [bootstrapNode, setBootstrapNode] = useState('/ip4/192.168.1.104/tcp/4001/p2p/12D3KooWQWwEb4DrNcW85vsp5brhxQaRk6bennUHYqMbMVDnABXV');
  const [logs, setLogs] = useState([]);
  const [isConfiguring, setIsConfiguring] = useState(false);
  const [peers, setPeers] = useState([]);

  const addLog = (message, type = 'info') => {
    const timestamp = new Date().toLocaleTimeString();
    setLogs(prev => [...prev, { message, type, timestamp }]);
  };

  const handleConfigureNetwork = async () => {
    setIsConfiguring(true);
    setLogs([]);

    try {
      const response = await axios.post(`${API_URL}/configure-network`, 
      {
        // Body-ul cererii
        swarmKey,
        bootstrapNode
      }, 
      {
        // MODIFICAT: Adaugă header-ul de autentificare
        headers: {
          'x-api-key': API_KEY
        }
      });

      if (response.data.success) {
        response.data.logs.forEach(log => {
          addLog(log.message, log.type);
        });
      }
    } catch (error) {
      // MODIFICAT: Gestionare îmbunătățită a erorilor
      if (error.response?.data?.logs) {
        error.response.data.logs.forEach(log => {
          addLog(log.message, log.type);
        });
      } else if (error.response?.data?.error) {
        addLog(`❌ Eroare Server: ${error.response.data.error}`, 'error');
      } else {
        addLog(`❌ Eroare Conexiune: ${error.message}`, 'error');
      }
    } finally {
      setIsConfiguring(false);
    }
  };

  const loadPeers = async () => {
    try {
      // MODIFICAT: Adaugă header-ul de autentificare
      const response = await axios.get(`${API_URL}/peers`, {
        headers: {
          'x-api-key': API_KEY
        }
      });
      
      if (response.data.success) {
        setPeers(response.data.peers);
        addLog(`✓ ${response.data.peers.length} peers conectați`, 'success');
      }
    } catch (error) {
      // MODIFICAT: Gestionare îmbunătățită a erorilor
      if (error.response?.data?.error) {
        addLog(`❌ Eroare Server: ${error.response.data.error}`, 'error');
      } else {
        addLog(`❌ Eroare la încărcarea peers: ${error.message}`, 'error');
      }
    }
  };

  const copySwarmKey = () => {
    const keyContent = `/key/swarm/psk/1.0.0/\n/base16/\n${swarmKey}`;
    navigator.clipboard.writeText(keyContent);
    addLog('Swarm key copiat în clipboard', 'success');
  };

  return (
    <div className="app-container">
      {/* Header */}
      <div className="header">
        <div className="header-content">
          <Network className="header-icon" />
          <div>
            <h1 className="header-title">IPFS Private Network Manager</h1>
            <p className="header-subtitle">Configurează și gestionează rețeaua ta privată IPFS</p>
          </div>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid-2">
        {/* Configuration Panel */}
        <div className="panel">
          <h2 className="panel-title">
            <Key />
            Configurare Swarm Key
          </h2>
          
          <div className="form-group">
            <label className="form-label">Swarm Key (hex)</label>
            <input
              type="text"
              value={swarmKey}
              onChange={(e) => setSwarmKey(e.target.value)}
              className="form-input"
              placeholder="ddd244b4b304dca4d8947b4444a1d76223334cfdafd674263b0b600feae39cbe"
            />
          </div>

          <div className="form-group">
            <label className="form-label">Bootstrap Node</label>
            <input
              type="text"
              value={bootstrapNode}
              onChange={(e) => setBootstrapNode(e.target.value)}
              className="form-input"
              placeholder="/ip4/192.168.1.104/tcp/4001/p2p/..."
            />
          </div>

          <button onClick={copySwarmKey} className="btn btn-secondary">
            Copiază Swarm Key
          </button>
        </div>

        {/* Info Panel */}
        <div className="panel">
          <h2 className="panel-title">
            <Shield />
            Ce face configurarea?
          </h2>
          
          <ul className="info-list">
            <li className="info-item">
              <CheckCircle />
              <div>
                <div className="info-item-title">Copiere swarm.key</div>
                <div className="info-item-desc">Cheia secretă pentru rețeaua privată</div>
              </div>
            </li>

            <li className="info-item">
              <CheckCircle />
              <div>
                <div className="info-item-title">Dezactivare AutoConf & AutoTLS</div>
                <div className="info-item-desc">Izolare de rețeaua publică IPFS</div>
              </div>
            </li>

            <li className="info-item">
              <CheckCircle />
              <div>
                <div className="info-item-title">Activare DHT Routing</div>
                <div className="info-item-desc">Descoperire peer-uri în rețea</div>
              </div>
            </li>

            <li className="info-item">
              <CheckCircle />
              <div>
                <div className="info-item-title">Ștergere servicii externe</div>
                <div className="info-item-desc">Routing și publishing doar intern</div>
              </div>
            </li>

            <li className="info-item">
              <CheckCircle />
              <div>
                <div className="info-item-title">Configurare Bootstrap</div>
                <div className="info-item-desc">Adaugă doar nodurile tale</div>
              </div>
            </li>
          </ul>
        </div>
      </div>

      {/* Action Buttons */}
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
              <Server />
              Configurează Rețeaua Privată
            </>
          )}
        </button>

        <button onClick={loadPeers} className="btn btn-info">
          <Users />
          Verifică Peers Conectați
        </button>
      </div>

      {/* Peers List */}
      {peers.length > 0 && (
        <div className="panel" style={{ marginTop: '24px' }}>
          <h2 className="panel-title">
            <Users />
            Peers Conectați ({peers.length})
          </h2>
          <div className="peers-container">
            {peers.map((peer, index) => (
              <div key={index} className="peer-item">
                {peer}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Logs */}
      {logs.length > 0 && (
        <div className="panel" style={{ marginTop: '24px' }}>
          <h2 className="panel-title">
            <AlertCircle />
            Log Execuție
          </h2>
          
          <div className="logs-container">
            {logs.map((log, index) => (
              <div key={index} className={`log-entry log-${log.type}`}>
                <span className="log-timestamp">[{log.timestamp}]</span> {log.message}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default App;