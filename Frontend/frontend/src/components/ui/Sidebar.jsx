import React from 'react';
import { NavLink } from 'react-router-dom';
import { motion } from 'framer-motion';
import { LayoutDashboard, Network, FileText, Box as BoxIcon, Server, ShoppingCart, Database, FileCheck, Coins, User, LogOut, Activity } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const menuItems = [
  { path: '/', icon: LayoutDashboard, label: 'Panou Principal' },
  { path: '/monitoring', icon: Activity, label: 'Monitoring', badge: 'NEW' },
  { path: '/solid-pods', icon: BoxIcon, label: 'Solid PODs' },
  { path: '/marketplace', icon: ShoppingCart, label: 'Piață' },
  { path: '/provider', icon: Database, label: 'Oferire Stocare' },
  { path: '/contracts', icon: FileCheck, label: 'Contracte & Wallet' },
  { path: '/network', icon: Network, label: 'Rețea' },
  { path: '/files', icon: FileText, label: 'Fișiere' },
  { path: '/cluster', icon: BoxIcon, label: 'Cluster' },
];

export const Sidebar = () => {
  return (
    <motion.div
      initial={{ x: -20, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      className="w-64 h-screen bg-dark-900 border-r border-dark-700 flex flex-col"
    >
      <div className="p-6 border-b border-dark-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-gradient-to-br from-primary-500 to-primary-600 rounded-xl flex items-center justify-center">
            <Server className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">IPFS Cloud</h1>
            <p className="text-xs text-gray-400">Rețea Distribuită</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 p-4 space-y-2">
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              `flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 relative ${
                isActive
                  ? 'bg-gradient-to-r from-primary-600 to-primary-500 text-white shadow-lg shadow-primary-500/30'
                  : 'text-gray-400 hover:bg-dark-800 hover:text-white'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon className="w-5 h-5" />
                <span className="font-medium">{item.label}</span>
                {item.badge && (
                  <span className="ml-auto px-2 py-0.5 bg-green-500 text-white text-xs rounded-full font-bold">
                    {item.badge}
                  </span>
                )}
                {isActive && !item.badge && (
                  <motion.div
                    layoutId="activeTab"
                    className="ml-auto w-2 h-2 bg-white rounded-full"
                  />
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      <div className="p-4 border-t border-dark-700">
        <div className="px-4 py-3 bg-dark-800 rounded-xl">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-400">Logged in as:</p>
            <button
              onClick={() => {
                localStorage.clear();
                window.location.href = '/login';
              }}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Logout
            </button>
          </div>
          <p className="text-xs text-white font-semibold truncate">
            @{localStorage.getItem('username') || 'unknown'}
          </p>
          <p className="text-xs text-gray-500 mt-2">© 2025 IPFS Cloud</p>
        </div>
      </div>
    </motion.div>
  );
};
