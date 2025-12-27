import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Download, FileIcon, Image as ImageIcon, FileText, Film, Music, Archive } from 'lucide-react';
import FileEncryption from '../../utils/fileEncryption';

const FilePreviewModal = ({ isOpen, onClose, file, onDownload }) => {
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [decryptionStatus, setDecryptionStatus] = useState('');

  useEffect(() => {
    if (isOpen && file) {
      loadPreview();
    }
    return () => {
      if (previewData && typeof previewData === 'string') {
        URL.revokeObjectURL(previewData);
      }
    };
  }, [isOpen, file]);

  const getFileType = (filename) => {
    let cleanName = filename;
    if (filename.endsWith('.encrypted')) {
      cleanName = filename.replace('.encrypted', '');
    }
    const ext = cleanName.split('.').pop().toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image';
    if (['pdf'].includes(ext)) return 'pdf';
    if (['mp4', 'webm', 'ogg'].includes(ext)) return 'video';
    if (['mp3', 'wav', 'ogg'].includes(ext)) return 'audio';
    if (['txt', 'md', 'json', 'xml', 'csv'].includes(ext)) return 'text';
    if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return 'archive';
    return 'unknown';
  };

  const loadPreview = async () => {
    setLoading(true);
    setError(null);
    setDecryptionStatus('');
    const GATEWAY = 'http://localhost:8080/ipfs';

    try {
      const isEncrypted = file.name.endsWith('.encrypted') || file.encryption?.encrypted;
      let previewUrl = null;
      let fileType = getFileType(file.name);
      const ipfsUrl = `${GATEWAY}/${file.cid || file.hash}`;

      if (isEncrypted) {
        setDecryptionStatus('Se descarcă fișierul criptat...');
        let keyString = null;
        if (file.contractId) {
          keyString = localStorage.getItem(`contract_key_${file.contractId}`);
        }
        if (!keyString && file.encryption?.key) {
          keyString = file.encryption.key;
        }
        if (!keyString) {
          throw new Error('Cheia de decriptare nu a fost găsită.');
        }

        let response;
        try {
          response = await fetch(ipfsUrl);
          if (!response.ok) throw new Error('Failed to fetch');
        } catch (e) {
          response = await fetch(`https://ipfs.io/ipfs/${file.cid || file.hash}`);
          if (!response.ok) throw new Error('Failed to fetch encrypted file');
        }

        const encryptedBlob = await response.blob();
        setDecryptionStatus('Se decriptează...');
        const key = await FileEncryption.importKey(keyString);
        let iv = file.encryption?.iv;

        const decryptionResult = await FileEncryption.decryptFile(encryptedBlob, key, iv, null);
        const decryptedBlob = decryptionResult.decryptedBlob;
        previewUrl = URL.createObjectURL(decryptedBlob);

        if (decryptionResult.metadata?.originalName) {
          fileType = getFileType(decryptionResult.metadata.originalName);
        }
      } else {
        previewUrl = ipfsUrl;
        if (fileType !== 'text') {
          try {
            const check = await fetch(previewUrl, { method: 'HEAD' });
            if (!check.ok) throw new Error('File not reachable');
          } catch (e) {
            previewUrl = `https://ipfs.io/ipfs/${file.cid || file.hash}`;
          }
        }
      }

      if (fileType === 'image' || fileType === 'pdf' || fileType === 'video' || fileType === 'audio') {
        setPreviewData(previewUrl);
      } else if (fileType === 'text') {
        const response = await fetch(previewUrl);
        const text = await response.text();
        setPreviewData(text);
      } else {
        setPreviewData(null);
      }
    } catch (err) {
      console.error('Error loading preview:', err);
      setError(err.message || 'Nu se poate încărca preview-ul');
    } finally {
      setLoading(false);
      setDecryptionStatus('');
    }
  };

  const renderPreview = () => {
    if (loading) {
      return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '3px solid var(--border)',
            borderTopColor: 'var(--accent)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            marginBottom: '16px'
          }} />
          {decryptionStatus && (
            <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>{decryptionStatus}</p>
          )}
        </div>
      );
    }

    if (error) {
      return (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '300px', color: '#ea4335' }}>
          <p>{error}</p>
        </div>
      );
    }

    const fileType = getFileType(file.name);

    switch (fileType) {
      case 'image':
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: 'var(--bg-tertiary)' }}>
            <img src={previewData} alt={file.name} style={{ maxWidth: '100%', maxHeight: '500px', objectFit: 'contain', borderRadius: '8px' }} />
          </div>
        );

      case 'video':
        return (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px', background: '#000' }}>
            <video src={previewData} controls style={{ maxWidth: '100%', maxHeight: '500px', borderRadius: '8px' }}>
              Browser-ul nu suportă video.
            </video>
          </div>
        );

      case 'audio':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '48px', background: 'var(--bg-tertiary)' }}>
            <Music size={80} color="var(--accent)" style={{ marginBottom: '24px', opacity: 0.6 }} />
            <audio src={previewData} controls style={{ width: '100%', maxWidth: '400px' }} />
          </div>
        );

      case 'text':
        return (
          <div style={{ padding: '24px', background: 'var(--bg-secondary)', maxHeight: '500px', overflow: 'auto' }}>
            <pre style={{ whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '13px', color: 'var(--text-primary)', margin: 0 }}>
              {previewData}
            </pre>
          </div>
        );

      case 'pdf':
        return (
          <div style={{ height: '500px' }}>
            <iframe src={previewData} style={{ width: '100%', height: '100%', border: 'none' }} title={file.name} />
          </div>
        );

      case 'archive':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--text-muted)' }}>
            <Archive size={80} style={{ marginBottom: '16px', opacity: 0.4 }} />
            <p style={{ fontSize: '16px', fontWeight: '500' }}>Fișier Arhivă</p>
            <p style={{ fontSize: '14px', marginTop: '8px' }}>Preview-ul nu este disponibil</p>
          </div>
        );

      default:
        return (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '300px', color: 'var(--text-muted)' }}>
            <FileIcon size={80} style={{ marginBottom: '16px', opacity: 0.4 }} />
            <p style={{ fontSize: '16px', fontWeight: '500' }}>Preview Indisponibil</p>
            <p style={{ fontSize: '14px', marginTop: '8px' }}>Acest tip de fișier nu poate fi previzualizat</p>
          </div>
        );
    }
  };

  const formatSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
  };

  const getFileIcon = () => {
    const fileType = getFileType(file?.name || '');
    switch (fileType) {
      case 'image': return ImageIcon;
      case 'video': return Film;
      case 'audio': return Music;
      case 'text':
      case 'pdf': return FileText;
      case 'archive': return Archive;
      default: return FileIcon;
    }
  };

  const FileTypeIcon = getFileIcon();

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '24px'
          }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            style={{
              background: 'var(--bg-primary)',
              borderRadius: '12px',
              boxShadow: 'var(--shadow-lg)',
              maxWidth: '900px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'hidden'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg-secondary)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '40px',
                  height: '40px',
                  borderRadius: '8px',
                  background: 'var(--accent-light)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}>
                  <FileTypeIcon size={20} color="var(--accent)" />
                </div>
                <div>
                  <h3 style={{ fontSize: '16px', fontWeight: '500', color: 'var(--text-primary)', margin: 0 }}>
                    {file?.name}
                  </h3>
                  <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
                    {file?.size && formatSize(file.size)} • CID: {file?.cid?.substring(0, 16)}...
                  </p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  onClick={() => onDownload(file)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    background: 'var(--accent)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '14px',
                    fontWeight: '500'
                  }}
                >
                  <Download size={16} />
                  Descarcă
                </button>
                <button
                  onClick={onClose}
                  style={{
                    width: '36px',
                    height: '36px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'transparent',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    color: 'var(--text-secondary)'
                  }}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Preview Area */}
            <div style={{ overflow: 'auto', maxHeight: 'calc(90vh - 140px)' }}>
              {renderPreview()}
            </div>

            {/* Footer with metadata */}
            {file && (
              <div style={{
                padding: '12px 20px',
                borderTop: '1px solid var(--border)',
                background: 'var(--bg-tertiary)',
                display: 'flex',
                gap: '24px',
                fontSize: '13px',
                color: 'var(--text-secondary)'
              }}>
                <div>
                  <span style={{ fontWeight: '500' }}>Uploaded:</span>{' '}
                  {file.addedAt ? new Date(file.addedAt).toLocaleString() : 'Necunoscut'}
                </div>
                <div>
                  <span style={{ fontWeight: '500' }}>Tip:</span>{' '}
                  {getFileType(file.name).toUpperCase()}
                </div>
                {file.encryption?.encrypted && (
                  <div style={{ color: '#34a853' }}>
                    🔒 Criptat
                  </div>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default FilePreviewModal;
