import React, { useState, useEffect } from 'react';
import { Upload, Download, Trash2, FileText, RefreshCw, Info, Activity, Network } from 'lucide-react';
import axios from 'axios';
import './FilesPanel.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const API_KEY = process.env.REACT_APP_API_KEY || 'supersecret';

function FilesPanel({ onLog }) {
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [description, setDescription] = useState('');
  const [tags, setTags] = useState('');
  const [keepPrivate, setKeepPrivate] = useState(false);
  const [selectedFileInfo, setSelectedFileInfo] = useState(null);
  const [transferStats, setTransferStats] = useState(null);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    loadFiles();
    loadTransferStats();
    const interval = setInterval(loadTransferStats, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/docker-cluster/pins`, {
        headers: { 'x-api-key': API_KEY }
      });
      if (response.data.success) {
        const pinsData = response.data.pins || [];
        const filesArray = Array.isArray(pinsData)
          ? pinsData
          : Object.entries(pinsData).map(([cid, info]) => ({
              hash: cid,
              name: info.name || `file-${cid.substring(0, 8)}`,
              size: info.size || 0,
              uploadedAt: info.timestamp || new Date().toISOString(),
              pinned: true,
              ...info
            }));
        setFiles(filesArray);
        onLog?.(`${filesArray.length} fisiere gasite in cluster`, 'success');
      }
    } catch (error) {
      onLog?.(`Eroare la incarcare fisiere: ${error.message}`, 'error');
      setFiles([]);
    } finally {
      setLoading(false);
    }
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
      onLog?.(`Incarcare fisier in cluster: ${selectedFile.name}...`, 'info');
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
        setSelectedFile(null);
        setDescription('');
        setTags('');
        document.getElementById('file-input').value = '';
        setTimeout(() => loadFiles(), 2000);
      }
    } catch (error) {
      onLog?.(`Eroare la upload: ${error.response?.data?.error || error.message}`, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (file) => {
    try {
      onLog?.(`Descarca fisier: ${file.name}...`, 'info');
      const response = await axios.get(`${API_URL}/docker-cluster/download/${file.hash}`, {
        headers: { 'x-api-key': API_KEY },
        responseType: 'blob',
        timeout: 30000
      });
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', file.name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
      onLog?.(`Fisier descarcat: ${file.name}`, 'success');
    } catch (error) {
      onLog?.(`Eroare la download: ${error.message}`, 'error');
    }
  };

  const loadTransferStats = async () => {
    try {
      const response = await axios.get(`${API_URL}/files/transfer-stats`, {
        headers: { 'x-api-key': API_KEY }
      });
      if (response.data.success) {
        setTransferStats(response.data.stats);
      }
    } catch (error) {}
  };

  const handleTestTransfer = async () => {
    setTesting(true);
    try {
      onLog?.('Test transfer intre noduri...', 'info');
      const response = await axios.post(`${API_URL}/files/test-transfer`, {}, {
        headers: { 'x-api-key': API_KEY }
      });
      if (response.data.success) {
        const test = response.data.test;
        onLog?.(`Test finalizat: ${test.peersConnected} peers, ${test.providersFound} provideri`, 'success');
        onLog?.(`Status: ${test.status}`, test.canTransfer ? 'success' : 'warning');
        await loadTransferStats();
      }
    } catch (error) {
      onLog?.(`Eroare la test: ${error.message}`, 'error');
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async (file) => {
    if (!window.confirm(`Sigur vrei sa stergi fisierul "${file.name}" din cluster?`)) {
      return;
    }
    try {
      onLog?.(`Stergere fisier din cluster: ${file.name}...`, 'info');
      const response = await axios.delete(`${API_URL}/docker-cluster/pin/${file.hash}`, {
        headers: { 'x-api-key': API_KEY }
      });
      if (response.data.success) {
        onLog?.(`Fisier sters din cluster: ${file.name}`, 'success');
        setTimeout(() => loadFiles(), 1000);
      }
    } catch (error) {
      onLog?.(`Eroare la stergere: ${error.message}`, 'error');
    }
  };

  const handleShowInfo = async (file) => {
    try {
      const response = await axios.get(`${API_URL}/docker-cluster/pin/${file.hash}`, {
        headers: { 'x-api-key': API_KEY }
      });
      if (response.data.success) {
        setSelectedFileInfo({
          ...file,
          replicationCount: response.data.replicationCount,
          peers: response.data.peers,
          pinStatus: response.data.pinStatus
        });
      }
    } catch (error) {
      onLog?.(`Eroare la obtinere info: ${error.message}`, 'error');
    }
  };

  const formatSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleString('en-US');
  };

  return (
    <div className="files-panel">
      <div className="panel">
        <h2 className="panel-title">
          <FileText />
          Gestionare Fișiere Cluster (Persistente)
        </h2>

        {transferStats && (
          <div className="transfer-stats">
            <div className="stats-grid">
              <div className="stat-card">
                <Network size={20} />
                <div>
                  <div className="stat-value">{transferStats.peersConnected}</div>
                  <div className="stat-label">Peers Conectați</div>
                </div>
              </div>
              <div className="stat-card">
                <FileText size={20} />
                <div>
                  <div className="stat-value">{transferStats.totalFiles}</div>
                  <div className="stat-label">Total Fișiere</div>
                </div>
              </div>
              <div className="stat-card">
                <Activity size={20} />
                <div>
                  <div className="stat-value">{transferStats.publicFiles}</div>
                  <div className="stat-label">Publice</div>
                </div>
              </div>
              <div className="stat-card">
                <Upload size={20} />
                <div>
                  <div className="stat-value">{transferStats.totalSizeMB} MB</div>
                  <div className="stat-label">Dimensiune Totală</div>
                </div>
              </div>
            </div>
            <div className="test-transfer-section">
              <button
                onClick={handleTestTransfer}
                disabled={testing}
                className="btn btn-test"
              >
                <Activity size={18} />
                {testing ? 'Testare în curs...' : 'Test Transfer Între Noduri'}
              </button>
              {transferStats.networkActive ? (
                <span className="status-badge success">Rețea Activă</span>
              ) : (
                <span className="status-badge warning">Fără Peers</span>
              )}
            </div>
          </div>
        )}

        <form onSubmit={handleUpload} className="upload-form">
          <div className="form-group">
            <label className="form-label">Selectează fișier</label>
            <input
              id="file-input"
              type="file"
              onChange={handleFileSelect}
              className="form-input"
              disabled={uploading}
            />
          </div>

          {selectedFile && (
            <>
              <div className="form-group">
                <label className="form-label">Descriere (opțional)</label>
                <input
                  type="text"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Descriere fișier..."
                  className="form-input"
                  disabled={uploading}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Etichete (separate prin virgulă)</label>
                <input
                  type="text"
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="ex: document, important, 2024"
                  className="form-input"
                  disabled={uploading}
                />
              </div>
            </>
          )}

          <button
            type="submit"
            className="btn btn-primary"
            disabled={!selectedFile || uploading}
          >
            {uploading ? (
              <>
                <RefreshCw className="spinning" size={20} />
                Se încarcă...
              </>
            ) : (
              <>
                <Upload size={20} />
                Adaugă în IPFS
              </>
            )}
          </button>
        </form>
      </div>

      <div className="panel" style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 className="panel-title" style={{ marginBottom: 0 }}>
            <FileText />
            Fișiere în rețea ({files.length})
          </h2>
          <button
            onClick={loadFiles}
            className="btn btn-secondary"
            disabled={loading}
            style={{ width: 'auto', padding: '8px 16px' }}
          >
            {loading ? (
              <RefreshCw className="spinning" size={16} />
            ) : (
              <RefreshCw size={16} />
            )}
          </button>
        </div>

        {loading ? (
          <p style={{ color: '#e9d5ff', textAlign: 'center' }}>Se încarcă fișierele...</p>
        ) : files.length === 0 ? (
          <p style={{ color: '#e9d5ff', textAlign: 'center' }}>Nu există fișiere în rețea</p>
        ) : (
          <div className="files-list">
            {files.map((file) => (
              <div key={file.hash} className="file-item">
                <div className="file-info">
                  <div className="file-name">{file.name}</div>
                  <div className="file-details">
                    <span>Hash: {file.hashShort}</span>
                    <span>•</span>
                    <span>{formatSize(file.size)}</span>
                    <span>•</span>
                    <span>{formatDate(file.uploadedAt)}</span>
                  </div>
                  {file.description && (
                    <div className="file-description">{file.description}</div>
                  )}
                  {file.tags && file.tags.length > 0 && (
                    <div className="file-tags">
                      {file.tags.map((tag, idx) => (
                        <span key={idx} className="tag">{tag}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="file-actions">
                  <button
                    onClick={() => handleShowInfo(file)}
                    className="action-btn"
                    title="Informații"
                  >
                    <Info size={18} />
                  </button>
                  <button
                    onClick={() => handleDownload(file)}
                    className="action-btn"
                    title="Descarcă"
                  >
                    <Download size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(file)}
                    className="action-btn delete"
                    title="Șterge"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedFileInfo && (
        <div className="modal-overlay" onClick={() => setSelectedFileInfo(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>Informații fișier</h3>
            <div className="info-grid">
              <div><strong>Nume:</strong> {selectedFileInfo.name}</div>
              <div><strong>Hash:</strong> {selectedFileInfo.hash}</div>
              <div><strong>Dimensiune:</strong> {formatSize(selectedFileInfo.size)}</div>
              <div><strong>Tip:</strong> {selectedFileInfo.mimetype}</div>
              <div><strong>Pinuit:</strong> {selectedFileInfo.isPinned ? '✓ Da' : '✗ Nu'}</div>
              <div><strong>Provideri:</strong> {selectedFileInfo.providersCount}</div>
              <div><strong>Încărcat:</strong> {formatDate(selectedFileInfo.uploadedAt)}</div>
            </div>
            <button
              onClick={() => setSelectedFileInfo(null)}
              className="btn btn-secondary"
              style={{ marginTop: '16px' }}
            >
              Închide
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default FilesPanel;