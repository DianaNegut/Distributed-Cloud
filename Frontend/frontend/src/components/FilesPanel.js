import React, { useState, useEffect } from 'react';
import { Upload, Download, Trash2, FileText, RefreshCw, Info } from 'lucide-react';
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
  const [selectedFileInfo, setSelectedFileInfo] = useState(null);

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const response = await axios.get(`${API_URL}/files/list`, {
        headers: { 'x-api-key': API_KEY }
      });
      
      if (response.data.success) {
        setFiles(response.data.files);
        onLog?.(`✓ ${response.data.totalFiles} fișiere găsite`, 'success');
      }
    } catch (error) {
      console.error('Eroare la încărcare fișiere:', error);
      onLog?.(`Eroare la încărcare fișiere: ${error.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      onLog?.(`Fișier selectat: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`, 'info');
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    
    if (!selectedFile) {
      onLog?.('Selectează un fișier mai întâi', 'error');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', selectedFile);
    formData.append('description', description);
    formData.append('tags', tags);

    try {
      onLog?.(`Încărcare fișier: ${selectedFile.name}...`, 'info');
      
      const response = await axios.post(`${API_URL}/files/upload`, formData, {
        headers: {
          'x-api-key': API_KEY,
          'Content-Type': 'multipart/form-data'
        }
      });

      if (response.data.success) {
        onLog?.(`✓ Fișier adăugat în IPFS: ${response.data.file.hash}`, 'success');
        setSelectedFile(null);
        setDescription('');
        setTags('');
        document.getElementById('file-input').value = '';
        await loadFiles();
      }
    } catch (error) {
      console.error('Eroare la upload:', error);
      onLog?.(`Eroare la upload: ${error.response?.data?.error || error.message}`, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async (file) => {
    try {
      onLog?.(`Descărcare fișier: ${file.name}...`, 'info');
      
      const response = await axios.get(`${API_URL}/files/download/${file.hash}`, {
        headers: { 'x-api-key': API_KEY },
        responseType: 'blob'
      });

      // Creează link de download
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', file.name);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);

      onLog?.(`✓ Fișier descărcat: ${file.name}`, 'success');
    } catch (error) {
      console.error('Eroare la download:', error);
      onLog?.(`Eroare la download: ${error.message}`, 'error');
    }
  };

  const handleDelete = async (file) => {
    if (!window.confirm(`Sigur vrei să ștergi fișierul "${file.name}"?`)) {
      return;
    }

    try {
      onLog?.(`Ștergere fișier: ${file.name}...`, 'info');
      
      const response = await axios.delete(`${API_URL}/files/delete/${file.hash}`, {
        headers: { 'x-api-key': API_KEY }
      });

      if (response.data.success) {
        onLog?.(`✓ Fișier șters: ${file.name}`, 'success');
        await loadFiles();
      }
    } catch (error) {
      console.error('Eroare la ștergere:', error);
      onLog?.(`Eroare la ștergere: ${error.message}`, 'error');
    }
  };

  const handleShowInfo = async (file) => {
    try {
      const response = await axios.get(`${API_URL}/files/info/${file.hash}`, {
        headers: { 'x-api-key': API_KEY }
      });

      if (response.data.success) {
        setSelectedFileInfo(response.data.file);
      }
    } catch (error) {
      console.error('Eroare la info:', error);
      onLog?.(`Eroare la obținere info: ${error.message}`, 'error');
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
    return new Date(dateString).toLocaleString('ro-RO');
  };

  return (
    <div className="files-panel">
      <div className="panel">
        <h2 className="panel-title">
          <FileText />
          Gestionare Fișiere IPFS
        </h2>

        {/* Upload Form */}
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

      {/* Files List */}
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

      {/* File Info Modal */}
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