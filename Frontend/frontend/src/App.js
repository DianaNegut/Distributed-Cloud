import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Sidebar } from './components/ui/Sidebar';
import NotificationProvider from './contexts/NotificationContext';
import Dashboard from './pages/Dashboard';
import MarketplacePage from './pages/MarketplacePage';
import ProviderPage from './pages/ProviderPage';
import ContractsPage from './pages/ContractsPage';
import NetworkPage from './pages/NetworkPage';
import FilesPage from './pages/FilesPage';
import ClusterPage from './pages/ClusterPage';

function App() {
  return (
    <NotificationProvider>
      <Router>
        <div className="flex h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900">
          <Sidebar />
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/marketplace" element={<MarketplacePage />} />
            <Route path="/provider" element={<ProviderPage />} />
            <Route path="/contracts" element={<ContractsPage />} />
            <Route path="/network" element={<NetworkPage />} />
            <Route path="/files" element={<FilesPage />} />
            <Route path="/cluster" element={<ClusterPage />} />
          </Routes>
        </div>
      </Router>
    </NotificationProvider>
  );
}

export default App;