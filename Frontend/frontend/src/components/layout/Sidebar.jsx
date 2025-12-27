import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    HardDrive,
    FileText,
    ShoppingCart,
    Server,
    Settings,
    Plus,
    Home,
    FileSignature
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const navItems = [
    { path: '/', icon: Home, label: 'Acasă' },
    { path: '/files', icon: FileText, label: 'Fișierele Mele' },
    { path: '/marketplace', icon: ShoppingCart, label: 'Cumpără Spațiu' },
    { path: '/contracts', icon: FileSignature, label: 'Contractele Mele' },
    { path: '/provider', icon: Server, label: 'Devino Provider' },
];

export default function Sidebar() {
    const location = useLocation();
    const { user } = useAuth();

    // Calculate storage usage (mock for now, should come from API)
    const storageUsed = 0;
    const storageTotal = 1;
    const storagePercent = (storageUsed / storageTotal) * 100;

    return (
        <aside className="sidebar">
            {/* Logo */}
            <div className="sidebar-logo">
                <HardDrive size={36} style={{ color: '#1a73e8' }} />
                <span className="sidebar-logo-text">
                    <span>Cloud</span> Drive
                </span>
            </div>

            {/* New Button */}
            <div className="sidebar-new-button">
                <Link to="/files" className="btn btn-new" style={{ width: '100%' }}>
                    <Plus size={24} />
                    Încarcă Fișier
                </Link>
            </div>

            {/* Navigation */}
            <nav className="sidebar-nav">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    const isActive = location.pathname === item.path;

                    return (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`sidebar-nav-item ${isActive ? 'active' : ''}`}
                        >
                            <Icon size={20} />
                            {item.label}
                        </Link>
                    );
                })}
            </nav>

            {/* Storage Usage */}
            {user && (
                <div className="sidebar-storage">
                    <div className="sidebar-storage-bar">
                        <div
                            className="sidebar-storage-fill"
                            style={{ width: `${storagePercent}%` }}
                        />
                    </div>
                    <span className="sidebar-storage-text">
                        {storageUsed} GB din {storageTotal} GB folosiți
                    </span>
                    <Link
                        to="/marketplace"
                        style={{
                            fontSize: '12px',
                            color: 'var(--accent)',
                            textDecoration: 'none',
                            marginTop: '4px',
                            display: 'block'
                        }}
                    >
                        Cumpără mai mult spațiu
                    </Link>
                </div>
            )}
        </aside>
    );
}
