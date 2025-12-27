import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Upload,
  FileText,
  FolderOpen,
  Clock,
  Star,
  Trash2,
  HardDrive,
  ShoppingCart,
  Server,
  Plus,
  Image,
  FileVideo,
  FileAudio,
  Archive
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const API_KEY = process.env.REACT_APP_API_KEY || 'supersecret';

const Dashboard = () => {
  const { user, sessionToken } = useAuth();
  const [userStorage, setUserStorage] = useState(null);
  const [recentFiles, setRecentFiles] = useState([]);
  const [stats, setStats] = useState({ totalFiles: 0, activeContracts: 0 });

  useEffect(() => {
    if (user) {
      loadUserStorage();
      loadRecentFiles();
      loadStats();
    }
  }, [user]);

  const loadUserStorage = async () => {
    try {
      const response = await axios.get(`${API_URL}/user-storage/${user.username}`, {
        headers: {
          'x-api-key': API_KEY,
          'x-session-token': sessionToken
        }
      });
      if (response.data.success) {
        setUserStorage(response.data);
      }
    } catch (error) {
      console.error('Error loading user storage:', error);
    }
  };

  const loadRecentFiles = async () => {
    try {
      const response = await axios.get(`${API_URL}/docker-cluster/pins`, {
        headers: { 'x-api-key': API_KEY, 'x-session-token': sessionToken }
      });
      if (response.data.success) {
        const myFiles = (response.data.pins || [])
          .filter(f => f.uploadedBy === user.username)
          .slice(0, 6);
        setRecentFiles(myFiles);
      }
    } catch (error) {
      console.error('Error loading files:', error);
    }
  };

  const loadStats = async () => {
    try {
      const [filesRes, contractsRes] = await Promise.all([
        axios.get(`${API_URL}/files/list`, { headers: { 'x-api-key': API_KEY } }),
        axios.get(`${API_URL}/storage-contracts`, { headers: { 'x-api-key': API_KEY } })
      ]);

      const activeContracts = (contractsRes.data?.contracts || [])
        .filter(c => c.status === 'active').length;

      setStats({
        totalFiles: filesRes.data?.totalFiles || 0,
        activeContracts
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const getFileIcon = (filename) => {
    if (!filename) return FileText;
    const ext = filename.split('.').pop()?.toLowerCase();
    if (['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(ext)) return Image;
    if (['mp4', 'avi', 'mov', 'mkv'].includes(ext)) return FileVideo;
    if (['mp3', 'wav', 'ogg'].includes(ext)) return FileAudio;
    if (['zip', 'rar', '7z'].includes(ext)) return Archive;
    return FileText;
  };

  const storagePercent = userStorage
    ? (userStorage.storage.usedGB / userStorage.storage.limitGB) * 100
    : 0;

  return (
    <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Welcome Header */}
      <div style={{ marginBottom: '32px' }}>
        <h1 style={{
          fontSize: '28px',
          fontWeight: '400',
          color: 'var(--text-primary)',
          marginBottom: '8px'
        }}>
          Bine ai venit, {user?.username}!
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
          Gestionează fișierele tale în cloud
        </p>
      </div>

      {/* Quick Actions */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '32px'
      }}>
        <Link to="/files" style={{ textDecoration: 'none' }}>
          <div style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            cursor: 'pointer',
            transition: 'box-shadow 0.2s, border-color 0.2s'
          }}
            onMouseOver={(e) => {
              e.currentTarget.style.boxShadow = 'var(--shadow-md)';
              e.currentTarget.style.borderColor = 'var(--accent)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.borderColor = 'var(--border)';
            }}
          >
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: '#e8f0fe',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Upload size={24} color="#1a73e8" />
            </div>
            <div>
              <p style={{ fontWeight: '500', color: 'var(--text-primary)' }}>Încarcă Fișier</p>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Adaugă fișiere noi</p>
            </div>
          </div>
        </Link>

        <Link to="/marketplace" style={{ textDecoration: 'none' }}>
          <div style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            cursor: 'pointer',
            transition: 'box-shadow 0.2s, border-color 0.2s'
          }}
            onMouseOver={(e) => {
              e.currentTarget.style.boxShadow = 'var(--shadow-md)';
              e.currentTarget.style.borderColor = 'var(--accent)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.borderColor = 'var(--border)';
            }}
          >
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: '#e6f4ea',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <ShoppingCart size={24} color="#34a853" />
            </div>
            <div>
              <p style={{ fontWeight: '500', color: 'var(--text-primary)' }}>Cumpără Spațiu</p>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Extinde stocarea</p>
            </div>
          </div>
        </Link>

        <Link to="/provider" style={{ textDecoration: 'none' }}>
          <div style={{
            background: 'var(--bg-primary)',
            border: '1px solid var(--border)',
            borderRadius: '12px',
            padding: '20px',
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            cursor: 'pointer',
            transition: 'box-shadow 0.2s, border-color 0.2s'
          }}
            onMouseOver={(e) => {
              e.currentTarget.style.boxShadow = 'var(--shadow-md)';
              e.currentTarget.style.borderColor = 'var(--accent)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.boxShadow = 'none';
              e.currentTarget.style.borderColor = 'var(--border)';
            }}
          >
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '12px',
              background: '#fef7e0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Server size={24} color="#f9ab00" />
            </div>
            <div>
              <p style={{ fontWeight: '500', color: 'var(--text-primary)' }}>Devino Provider</p>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Câștigă oferind spațiu</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Storage Overview */}
      <div style={{
        background: 'var(--bg-primary)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '24px',
        marginBottom: '32px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <HardDrive size={24} color="var(--accent)" />
            <h2 style={{ fontSize: '18px', fontWeight: '500', color: 'var(--text-primary)' }}>
              Stocarea Ta
            </h2>
          </div>
          {userStorage?.storage?.isDefault && (
            <Link to="/marketplace" style={{
              padding: '8px 16px',
              background: 'var(--accent)',
              color: 'white',
              borderRadius: '8px',
              textDecoration: 'none',
              fontSize: '14px',
              fontWeight: '500'
            }}>
              Cumpără mai mult
            </Link>
          )}
        </div>

        <div style={{ marginBottom: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
            <span style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
              {userStorage?.storage?.usedGB || 0} GB folosiți din {userStorage?.storage?.limitGB || 1} GB
            </span>
            <span style={{
              color: storagePercent > 80 ? '#ea4335' : 'var(--text-secondary)',
              fontSize: '14px',
              fontWeight: '500'
            }}>
              {storagePercent.toFixed(0)}%
            </span>
          </div>
          <div style={{
            height: '8px',
            background: 'var(--bg-tertiary)',
            borderRadius: '4px',
            overflow: 'hidden'
          }}>
            <div style={{
              height: '100%',
              width: `${Math.min(storagePercent, 100)}%`,
              background: storagePercent > 80 ? '#ea4335' : 'var(--accent)',
              borderRadius: '4px',
              transition: 'width 0.3s'
            }} />
          </div>
        </div>

        <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={16} color="var(--text-muted)" />
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              {recentFiles.length} fișiere
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FolderOpen size={16} color="var(--text-muted)" />
            <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
              {stats.activeContracts} contracte active
            </span>
          </div>
        </div>
      </div>

      {/* Recent Files */}
      <div style={{
        background: 'var(--bg-primary)',
        border: '1px solid var(--border)',
        borderRadius: '12px',
        padding: '24px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <Clock size={24} color="var(--accent)" />
            <h2 style={{ fontSize: '18px', fontWeight: '500', color: 'var(--text-primary)' }}>
              Fișiere Recente
            </h2>
          </div>
          <Link to="/files" style={{
            color: 'var(--accent)',
            textDecoration: 'none',
            fontSize: '14px',
            fontWeight: '500'
          }}>
            Vezi toate →
          </Link>
        </div>

        {recentFiles.length > 0 ? (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
            gap: '16px'
          }}>
            {recentFiles.map((file, index) => {
              const Icon = getFileIcon(file.name);
              return (
                <div key={index} style={{
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  transition: 'box-shadow 0.2s'
                }}
                  onMouseOver={(e) => e.currentTarget.style.boxShadow = 'var(--shadow-md)'}
                  onMouseOut={(e) => e.currentTarget.style.boxShadow = 'none'}
                >
                  <div style={{
                    height: '100px',
                    background: 'var(--bg-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Icon size={40} color="var(--text-muted)" />
                  </div>
                  <div style={{ padding: '12px' }}>
                    <p style={{
                      fontSize: '14px',
                      fontWeight: '500',
                      color: 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {file.name || 'Fișier'}
                    </p>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {file.size ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'N/A'}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{
            textAlign: 'center',
            padding: '48px 24px',
            color: 'var(--text-muted)'
          }}>
            <FolderOpen size={64} style={{ opacity: 0.3, marginBottom: '16px' }} />
            <p style={{ fontSize: '16px', marginBottom: '8px' }}>Nu ai încă fișiere</p>
            <p style={{ fontSize: '14px', marginBottom: '16px' }}>Încarcă primul tău fișier pentru a începe</p>
            <Link to="/files" style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '12px 24px',
              background: 'var(--accent)',
              color: 'white',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: '500'
            }}>
              <Plus size={20} />
              Încarcă Fișier
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
