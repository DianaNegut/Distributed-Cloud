import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Settings, HelpCircle, FileText, Image, Video, Music, Archive, X } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import axios from 'axios';
import toast from 'react-hot-toast';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';
const API_KEY = process.env.REACT_APP_API_KEY || 'supersecret';

export default function Header() {
    const { user, logout, sessionToken } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [files, setFiles] = useState([]);
    const [filteredFiles, setFilteredFiles] = useState([]);
    const [showDropdown, setShowDropdown] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [loading, setLoading] = useState(false);
    const [storageUsed, setStorageUsed] = useState('0 GB');
    const navigate = useNavigate();
    const searchRef = useRef(null);

    // Load files when component mounts
    useEffect(() => {
        if (user) {
            loadFiles();
        }
    }, [user]);

    // Filter files when search query changes
    useEffect(() => {
        if (searchQuery.trim().length > 0) {
            const query = searchQuery.toLowerCase();
            const filtered = files.filter(f =>
                f.name && f.name.toLowerCase().includes(query)
            ).slice(0, 10); // Max 10 results
            setFilteredFiles(filtered);
            setShowDropdown(true);
        } else {
            setFilteredFiles([]);
            setShowDropdown(false);
        }
    }, [searchQuery, files]);

    // Close dropdowns when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (searchRef.current && !searchRef.current.contains(e.target)) {
                setShowDropdown(false);
            }
            // Close settings dropdown when clicking outside
            if (!e.target.closest('.settings-dropdown')) {
                setShowSettings(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Load storage info
    useEffect(() => {
        if (user) {
            loadStorageInfo();
        }
    }, [user]);

    const loadStorageInfo = async () => {
        try {
            const response = await axios.get(`${API_URL}/user-storage/${user.username}`, {
                headers: { 'x-api-key': API_KEY, 'x-session-token': sessionToken }
            });
            if (response.data.success) {
                setStorageUsed(`${response.data.storage.usedGB} GB / ${response.data.storage.limitGB} GB`);
            }
        } catch (error) {
            console.error('Error loading storage:', error);
        }
    };

    const loadFiles = async () => {
        try {
            setLoading(true);
            const response = await axios.get(`${API_URL}/docker-cluster/pins`, {
                headers: {
                    'x-api-key': API_KEY,
                    'x-session-token': sessionToken
                }
            });
            if (response.data.success) {
                const userFiles = (response.data.pins || []).filter(f => f.uploadedBy === user.username);
                setFiles(userFiles);
            }
        } catch (error) {
            console.error('Error loading files for search:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        if (window.confirm('Vrei să te deconectezi?')) {
            await logout();
            navigate('/login');
        }
    };

    const handleSearch = (e) => {
        e.preventDefault();
        if (searchQuery.trim()) {
            navigate(`/files?search=${encodeURIComponent(searchQuery.trim())}`);
            setShowDropdown(false);
        }
    };

    const handleSelectFile = (file) => {
        navigate(`/files?search=${encodeURIComponent(file.name)}`);
        setSearchQuery('');
        setShowDropdown(false);
    };

    const getFileIcon = (filename) => {
        if (!filename) return FileText;
        const ext = filename.split('.').pop()?.toLowerCase();
        if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return Image;
        if (['mp4', 'avi', 'mov', 'mkv', 'webm'].includes(ext)) return Video;
        if (['mp3', 'wav', 'ogg', 'flac'].includes(ext)) return Music;
        if (['zip', 'rar', '7z', 'tar', 'gz'].includes(ext)) return Archive;
        return FileText;
    };

    return (
        <header className="header">
            {/* Search Bar with Dropdown */}
            <div ref={searchRef} className="header-search" style={{ position: 'relative' }}>
                <form onSubmit={handleSearch}>
                    <Search
                        size={20}
                        style={{
                            position: 'absolute',
                            left: '16px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'var(--text-muted)',
                            cursor: 'pointer',
                            zIndex: 1
                        }}
                        onClick={handleSearch}
                    />
                    <input
                        type="text"
                        className="header-search-input"
                        placeholder="Caută fișiere..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        onFocus={() => searchQuery.trim() && setShowDropdown(true)}
                    />
                    {searchQuery && (
                        <X
                            size={18}
                            style={{
                                position: 'absolute',
                                right: '16px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                color: 'var(--text-muted)',
                                cursor: 'pointer'
                            }}
                            onClick={() => {
                                setSearchQuery('');
                                setShowDropdown(false);
                            }}
                        />
                    )}
                </form>

                {/* Dropdown Results */}
                {showDropdown && (
                    <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        right: 0,
                        marginTop: '4px',
                        background: 'var(--bg-primary)',
                        border: '1px solid var(--border)',
                        borderRadius: '8px',
                        boxShadow: 'var(--shadow-lg)',
                        maxHeight: '400px',
                        overflowY: 'auto',
                        zIndex: 100
                    }}>
                        {loading ? (
                            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                Se încarcă...
                            </div>
                        ) : filteredFiles.length > 0 ? (
                            filteredFiles.map((file, index) => {
                                const Icon = getFileIcon(file.name);
                                return (
                                    <div
                                        key={file.hash || index}
                                        onClick={() => handleSelectFile(file)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                            padding: '12px 16px',
                                            cursor: 'pointer',
                                            borderBottom: index < filteredFiles.length - 1 ? '1px solid var(--border-light)' : 'none',
                                            transition: 'background 0.15s'
                                        }}
                                        onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                        onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                        <div style={{
                                            width: '36px',
                                            height: '36px',
                                            borderRadius: '8px',
                                            background: 'var(--bg-tertiary)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center'
                                        }}>
                                            <Icon size={18} color="var(--text-muted)" />
                                        </div>
                                        <div style={{ flex: 1, minWidth: 0 }}>
                                            <p style={{
                                                fontSize: '14px',
                                                fontWeight: '500',
                                                color: 'var(--text-primary)',
                                                overflow: 'hidden',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap'
                                            }}>
                                                {file.name}
                                            </p>
                                            <p style={{
                                                fontSize: '12px',
                                                color: 'var(--text-muted)'
                                            }}>
                                                {file.size ? `${(file.size / 1024 / 1024).toFixed(2)} MB` : 'N/A'}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div style={{
                                padding: '24px 16px',
                                textAlign: 'center',
                                color: 'var(--text-muted)'
                            }}>
                                <Search size={32} style={{ opacity: 0.3, marginBottom: '8px' }} />
                                <p style={{ fontSize: '14px' }}>Niciun rezultat pentru "{searchQuery}"</p>
                            </div>
                        )}

                        {filteredFiles.length > 0 && (
                            <div
                                onClick={handleSearch}
                                style={{
                                    padding: '12px 16px',
                                    textAlign: 'center',
                                    borderTop: '1px solid var(--border)',
                                    color: 'var(--accent)',
                                    fontSize: '14px',
                                    fontWeight: '500',
                                    cursor: 'pointer'
                                }}
                                onMouseOver={(e) => e.currentTarget.style.background = 'var(--accent-light)'}
                                onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                            >
                                Vezi toate rezultatele →
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="header-actions">
                <button className="header-icon-btn" title="Ajutor">
                    <HelpCircle size={20} />
                </button>

                {/* Settings Dropdown */}
                <div style={{ position: 'relative' }}>
                    <button
                        className="header-icon-btn"
                        title="Setări"
                        onClick={() => setShowSettings(!showSettings)}
                    >
                        <Settings size={20} />
                    </button>

                    {showSettings && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            right: 0,
                            marginTop: '8px',
                            width: '220px',
                            background: 'var(--bg-primary)',
                            border: '1px solid var(--border)',
                            borderRadius: '8px',
                            boxShadow: 'var(--shadow-lg)',
                            zIndex: 100,
                            overflow: 'hidden'
                        }}>
                            {/* User Info */}
                            <div style={{
                                padding: '16px',
                                borderBottom: '1px solid var(--border)',
                                background: 'var(--bg-tertiary)'
                            }}>
                                <p style={{ fontWeight: '500', color: 'var(--text-primary)', marginBottom: '4px' }}>
                                    {user?.username}
                                </p>
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                    {user?.email || 'Cont Personal'}
                                </p>
                            </div>

                            {/* Menu Items */}
                            <div style={{ padding: '8px 0' }}>
                                <div
                                    onClick={() => { navigate('/contracts'); setShowSettings(false); }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '10px 16px',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        color: 'var(--text-primary)'
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    Contractele Mele
                                </div>
                                <div
                                    onClick={() => { navigate('/provider'); setShowSettings(false); }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '10px 16px',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        color: 'var(--text-primary)'
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    Setări Provider
                                </div>
                                <div
                                    onClick={() => {
                                        toast.success('Spațiu de stocare: ' + (storageUsed || '0 GB') + ' folosit');
                                        setShowSettings(false);
                                    }}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '12px',
                                        padding: '10px 16px',
                                        cursor: 'pointer',
                                        fontSize: '14px',
                                        color: 'var(--text-primary)'
                                    }}
                                    onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                                    onMouseOut={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    Vezi Stocare
                                </div>
                            </div>

                            {/* Logout */}
                            {/* Logout removed from dropdown - kept separate */}
                        </div>
                    )}
                </div>

                {user && (
                    <>
                        <div
                            className="header-avatar"
                            title={user.username}
                        >
                            {user.username.charAt(0).toUpperCase()}
                        </div>
                        <button
                            className="header-icon-btn"
                            title="Logout"
                            onClick={handleLogout}
                            style={{ color: '#ea4335' }}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" /></svg>
                        </button>
                    </>
                )}
            </div>
        </header>
    );
}
