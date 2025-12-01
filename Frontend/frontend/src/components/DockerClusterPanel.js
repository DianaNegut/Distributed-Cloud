import React, { useState, useEffect } from 'react';
import { Server, Upload, Download, Trash2, RefreshCw, Info, CheckCircle, XCircle, Activity } from 'lucide-react';
import axios from 'axios';
import './DockerClusterPanel.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const API_KEY = process.env.REACT_APP_API_KEY || 'supersecret';

function DockerClusterPanel({ onLog }) {
  const [clusterStatus, setClusterStatus] = useState(null);
  const [pins, setPins] = useState([]);
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedPinInfo, setSelectedPinInfo] = useState(null);

  useEffect(() => {
    loadClusterStatus();
    loadPins();
    loadHealth();
  }, []);

  const loadClusterStatus = async () => {
    try {
      const response = await axios.get(`${API_URL}/docker-cluster/status`, {
        headers: { 'x-api-key': API_KEY }
      });
      if (response.data.success) {
        setClusterStatus(response.data.cluster);
        onLog?.(`Cluster Docker activ: ${response.data.cluster.totalNodes} noduri`, 'success');
      }
    } catch (error) {
      onLog?.(`Cluster Docker nu este disponibil: ${error.message}`, 'error');
    }
  };

  const loadPins = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/docker-cluster/pins`, {
        headers: { 'x-api-key': API_KEY }
      });
      if (response.data.success) {
        const pinsData = response.data.pins || [];
        const pinsArray = Array.isArray(pinsData) ? pinsData : Object.keys(pinsData);
        setPins(pinsArray);
        onLog?.(`${response.data.totalPins || pinsArray.length} fisiere in cluster Docker`, 'success');
      }
    } catch (error) {
      onLog?.(`Eroare la incarcare fisiere: ${error.message}`, 'error');
      setPins([]);
    } finally {
      setLoading(false);
    }
  };

  const loadHealth = async () => {
    try {
      const response = await axios.get(`${API_URL}/docker-cluster/health`, {
        headers: { 'x-api-key': API_KEY }
      });
      if (response.data.success) {
        setHealth(response.data.health);
      }
    } catch (error) {}
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      onLog?.(`Fisier selectat: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`, 'info');
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!selectedFile) {
      onLog?.('Selecteaza un fisier mai intai', 'error');
      return;
    }
    setUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    try {
      onLog?.(`Upload in cluster Docker: ${selectedFile.name}...`, 'info');
      const response = await axios.post(`${API_URL}/docker-cluster/add`, formData, {
        headers: {
          'x-api-key': API_KEY,
          'Content-Type': 'multipart/form-data'
        },
        timeout: 60000
      });
      if (response.data.success) {
        const fileData = response.data.file;
        onLog?.(`Fisier adaugat in cluster: ${fileData.cid}`, 'success');
        onLog?.(`Replicat pe ${fileData.pinnedOn} noduri`, 'success');
        if (fileData.accessUrls && fileData.accessUrls.length > 0) {
          onLog?.(`Acces direct: ${fileData.accessUrls[0]}`, 'info');
        }
        setSelectedFile(null);
        document.getElementById('docker-file-input').value = '';
        setTimeout(() => loadPins(), 2000);
      }
    } catch (error) {
      onLog?.(`Eroare la upload: ${error.response?.data?.error || error.message}`, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleViewInfo = async (cid) => {
    try {
      onLog?.(`Obtine informatii pentru ${cid}...`, 'info');
      const response = await axios.get(`${API_URL}/docker-cluster/pin/${cid}`, {
        headers: { 'x-api-key': API_KEY }
      });
      if (response.data.success) {
        setSelectedPinInfo(response.data);
        onLog?.(`Replicat pe ${response.data.replicationCount} noduri`, 'success');
      }
    } catch (error) {
      onLog?.(`Eroare la obtinere informatii: ${error.message}`, 'error');
    }
  };

  const handleViewInBrowser = (cid) => {
    const url = `http://localhost:8080/ipfs/${cid}`;
    window.open(url, '_blank');
    onLog?.(`Deschis in browser: ${url}`, 'info');
  };

  const handleDownload = async (cid, filename = null) => {
    try {
      onLog?.(`Descarca ${cid} din cluster...`, 'info');
      const response = await axios.get(`${API_URL}/docker-cluster/download/${cid}`, {
        headers: { 'x-api-key': API_KEY },
        responseType: 'blob',
        timeout: 30000
      });
      const contentDisposition = response.headers['content-disposition'];
      let downloadFilename = filename || cid;
      if (contentDisposition) {
        const filenameMatch = contentDisposition.match(/filename="?([^"]+)"?/);
        if (filenameMatch) {
          downloadFilename = filenameMatch[1];
        }
      }
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', downloadFilename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      onLog?.(`Fisier descarcat: ${downloadFilename}`, 'success');
    } catch (error) {
      onLog?.(`Eroare la download: ${error.message}`, 'error');
    }
  };

  const handleDelete = async (cid) => {
    if (!window.confirm(`Sigur vrei sa stergi acest fisier din cluster?\nCID: ${cid}`)) {
      return;
    }
    try {
      onLog?.(`Stergere ${cid} din cluster...`, 'info');
      const response = await axios.delete(`${API_URL}/docker-cluster/pin/${cid}`, {
        headers: { 'x-api-key': API_KEY }
      });
      if (response.data.success) {
        onLog?.(`Fisier sters din cluster: ${cid}`, 'success');
        await loadPins();
      }
    } catch (error) {
      onLog?.(`Eroare la stergere: ${error.message}`, 'error');
    }
  };

  const handleRefresh = () => {
    onLog?.('Actualizare date cluster...', 'info');
    loadClusterStatus();
    loadPins();
    loadHealth();
  };

  return (
    <div className="docker-cluster-container">
      {health && (
        <div className={`health-banner ${health.status.toLowerCase()}`}>
          <Activity size={20} />
          <div className="health-info">
            <strong>Status Cluster: {health.status}</strong>
            <span>{health.onlineNodes}/{health.totalNodes} noduri online</span>
          </div>
        </div>
      )}

      <div className="panel">
        <div className="panel-header">
          <h2 className="panel-title">
            <Server />
            Cluster IPFS Docker
          </h2>
          <button onClick={handleRefresh} className="btn-icon" title="Actualizeaza">
            <RefreshCw size={18} />
          </button>
        </div>

        {clusterStatus ? (
          <div className="cluster-stats">
            <div className="stat-card">
              <div className="stat-label">Noduri Totale</div>
              <div className="stat-value">{clusterStatus.totalNodes}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Peers Conectati</div>
              <div className="stat-value">{clusterStatus.peers}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Fisiere Pinuite</div>
              <div className="stat-value">{clusterStatus.pinnedFiles}</div>
            </div>
          </div>
        ) : (
          <div className="cluster-offline">
            <XCircle size={48} />
            <p>Cluster Docker nu este disponibil</p>
            <p className="hint">Asigura-te ca ai pornit cluster-ul cu: <code>.\start.ps1</code></p>
          </div>
        )}

        {clusterStatus && (
          <div className="nodes-list">
            <h3>Noduri Disponibile:</h3>
            {clusterStatus.nodes.map((node, idx) => (
              <div key={idx} className="node-item">
                <CheckCircle size={16} className="node-status" />
                <span>Node {idx + 1}: {node}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {clusterStatus && (
        <div className="panel">
          <h2 className="panel-title">
            <Upload />
            Upload in Cluster Docker
          </h2>

          <form onSubmit={handleUpload} className="upload-form">
            <div className="form-group">
              <label className="form-label">Selecteaza fisier</label>
              <input
                id="docker-file-input"
                type="file"
                onChange={handleFileSelect}
                className="form-input"
                disabled={uploading}
              />
            </div>

            {selectedFile && (
              <div className="file-preview">
                <strong>{selectedFile.name}</strong>
                <span>{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</span>
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary"
              disabled={!selectedFile || uploading}
            >
              {uploading ? (
                <>
                  <RefreshCw className="spinning" size={20} />
                  Se incarca in cluster...
                </>
              ) : (
                <>
                  <Upload size={20} />
                  Adauga in Cluster Docker
                </>
              )}
            </button>
          </form>

          <div className="upload-info">
            <Info size={16} />
            <span>Fisierul va fi replicat automat pe toate cele {clusterStatus.totalNodes} noduri</span>
          </div>
        </div>
      )}

      {clusterStatus && (
        <div className="panel">
          <div className="panel-header">
            <h2 className="panel-title">
              Fisiere in Cluster ({pins.length})
            </h2>
            <button onClick={loadPins} className="btn-icon" disabled={loading}>
              {loading ? (
                <RefreshCw className="spinning" size={18} />
              ) : (
                <RefreshCw size={18} />
              )}
            </button>
          </div>

          {loading ? (
            <p className="loading-text">Se incarca fisierele...</p>
          ) : pins.length === 0 ? (
            <p className="empty-text">Nu exista fisiere in cluster</p>
          ) : (
            <div className="pins-list">
              {pins.map((pin, idx) => (
                <div key={idx} className="pin-item">
                  <div className="pin-info">
                    <div className="pin-cid" title={pin}>{pin.substring(0, 20)}...{pin.substring(pin.length - 10)}</div>
                  </div>
                  <div className="pin-actions">
                    <button
                      onClick={() => handleViewInBrowser(pin)}
                      className="action-btn view"
                      title="Vezi in browser"
                    >
                      <Server size={18} />
                    </button>
                    <button
                      onClick={() => handleViewInfo(pin)}
                      className="action-btn"
                      title="Informatii"
                    >
                      <Info size={18} />
                    </button>
                    <button
                      onClick={() => handleDownload(pin)}
                      className="action-btn"
                      title="Descarca"
                    >
                      <Download size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(pin)}
                      className="action-btn delete"
                      title="Sterge"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {selectedPinInfo && (
        <div className="modal-overlay" onClick={() => setSelectedPinInfo(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Detalii Fisier in Cluster</h3>
            <div className="info-section">
              <strong>CID:</strong>
              <code className="cid-full">{selectedPinInfo.cid}</code>
            </div>
            <div className="info-section">
              <strong>Replicare:</strong>
              <div className="replication-info">
                <CheckCircle size={16} style={{ color: '#10b981' }} />
                <span>Fisierul este replicat pe {selectedPinInfo.replicationCount} noduri</span>
              </div>
            </div>
            {selectedPinInfo.status && selectedPinInfo.status.peer_map && (
              <div className="info-section">
                <strong>Status pe noduri:</strong>
                <div className="peers-status">
                  {Object.entries(selectedPinInfo.status.peer_map).map(([peerId, peerInfo]) => (
                    <div key={peerId} className="peer-status-item">
                      {peerInfo.status === 'pinned' ? (
                        <CheckCircle size={14} style={{ color: '#10b981' }} />
                      ) : (
                        <Activity size={14} style={{ color: '#f59e0b' }} />
                      )}
                      <span>{peerInfo.peername || 'Unknown'}</span>
                      <span className={`status-badge ${peerInfo.status}`}>{peerInfo.status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="info-section">
              <strong>Acceseaza fisierul:</strong>
              <div className="access-urls">
                <button
                  onClick={() => handleViewInBrowser(selectedPinInfo.cid)}
                  className="btn btn-primary"
                  style={{ marginRight: '8px' }}
                >
                  Deschide in Browser
                </button>
                <button
                  onClick={() => {
                    navigator.clipboard.writeText(`http://localhost:8080/ipfs/${selectedPinInfo.cid}`);
                    onLog?.('Link copiat in clipboard', 'success');
                  }}
                  className="btn btn-secondary"
                >
                  Copiaza Link
                </button>
              </div>
            </div>
            <button
              onClick={() => setSelectedPinInfo(null)}
              className="btn btn-secondary"
              style={{ marginTop: '16px', width: '100%' }}
            >
              Inchide
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default DockerClusterPanel;