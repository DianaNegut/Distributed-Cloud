import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/ui/Sidebar';
import NotificationProvider from './contexts/NotificationContext';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import Dashboard from './pages/Dashboard';
import MarketplacePage from './pages/MarketplacePage';
import ProviderPage from './pages/ProviderPage';
import ContractsPage from './pages/ContractsPage';
import NetworkPage from './pages/NetworkPage';
import FilesPage from './pages/FilesPage';
import ClusterPage from './pages/ClusterPage';
import SolidPodsPage from './pages/SolidPodsPage';
import MonitoringDashboard from './pages/MonitoringDashboard';
import LoginPage from './pages/LoginPage';

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-gray-900">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-400 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
      </div>
    );
  }

  return isAuthenticated ? children : <Navigate to="/login" replace />;
};

function AppContent() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="flex h-screen bg-gradient-to-br from-dark-900 via-dark-800 to-dark-900">
      {isAuthenticated && <Sidebar />}
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />
        <Route
          path="/marketplace"
          element={
            <ProtectedRoute>
              <MarketplacePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/provider"
          element={
            <ProtectedRoute>
              <ProviderPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/contracts"
          element={
            <ProtectedRoute>
              <ContractsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/network"
          element={
            <ProtectedRoute>
              <NetworkPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/files"
          element={
            <ProtectedRoute>
              <FilesPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/cluster"
          element={
            <ProtectedRoute>
              <ClusterPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/solid-pods"
          element={
            <ProtectedRoute>
              <SolidPodsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/monitoring"
          element={
            <ProtectedRoute>
              <MonitoringDashboard />
            </ProtectedRoute>
          }
        />
      </Routes>
    </div>
  );
}

function App() {
  return (
    <NotificationProvider>
      <AuthProvider>
        <Router>
          <AppContent />
        </Router>
      </AuthProvider>
    </NotificationProvider>
  );
}

export default App;
