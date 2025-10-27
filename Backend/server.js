// server.js - Updated for IPFS-only Cluster
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ensureKuboInstalled } = require('./utils/ensureKuboInstalled');
const { IPFS_PATH, KUBO_PATH, IPFS_BIN } = require('./config/paths');

// Middleware-uri
const corsConfig = require('./middleware/corsConfig');
const logger = require('./middleware/logger');
const auth = require('./middleware/auth');

// Rute existente
const bootstrapRoutes = require('./routes/bootstrap');
const joinRoutes = require('./routes/join');
const configNetworkRoutes = require('./routes/configNetwork');
const statusRoutes = require('./routes/status');
const peersRoutes = require('./routes/peers');
const healthRoutes = require('./routes/health');

// Rute cluster (NEW)
const clusterRoutes = require('./routes/cluster');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware global
app.use(cors(corsConfig));
app.use(express.json());
app.use(logger);
app.use(auth);

// Rute API existente
app.use('/api/bootstrap-info', bootstrapRoutes);
app.use('/api/join-network', joinRoutes);
app.use('/api/configure-network', configNetworkRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/peers', peersRoutes);
app.use('/api/health', healthRoutes);

// Rute API Cluster (NEW) - IPFS-only storage
app.use('/api/cluster', clusterRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'IPFS Cluster Backend Server',
    version: '2.0.0-cluster',
    description: 'Distributed IPFS storage with replication',
    features: [
      'IPFS P2P Network',
      'File Clustering & Replication',
      'Metadata Management',
      'Health Monitoring',
      'Network Bootstrap'
    ],
    endpoints: {
      health: '/api/health',
      cluster: {
        status: 'GET /api/cluster/status',
        init: 'POST /api/cluster/init',
        addFile: 'POST /api/cluster/add',
        listFiles: 'GET /api/cluster/files',
        fileAvailability: 'GET /api/cluster/availability/:hash',
        setReplication: 'POST /api/cluster/set-replication',
        deleteFile: 'DELETE /api/cluster/files/:hash',
        health: 'GET /api/cluster/health'
      },
      peers: '/api/peers',
      status: '/api/status'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ 
    success: false, 
    error: err.message || 'Internal Server Error' 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Route not found',
    availableEndpoints: 'GET /'
  });
});

// Pornire server
app.listen(PORT, async () => {
  console.log(`
╔════════════════════════════════════════════════╗
║   🚀 IPFS Cluster Backend Server               ║
╚════════════════════════════════════════════════╝

📍 Port: ${PORT}
📁 IPFS Path: ${IPFS_PATH}
📦 Kubo Path: ${KUBO_PATH}
🔐 Auth: Enabled (x-api-key header required)

🌐 API Endpoints:
  ✓ Health: http://localhost:${PORT}/api/health
  ✓ Cluster Init: POST http://localhost:${PORT}/api/cluster/init
  ✓ Add File: POST http://localhost:${PORT}/api/cluster/add
  ✓ List Files: GET http://localhost:${PORT}/api/cluster/files
  ✓ Status: GET http://localhost:${PORT}/api/cluster/status
  ✓ Health: GET http://localhost:${PORT}/api/cluster/health

📚 Full documentation: GET http://localhost:${PORT}/

  `);

  await ensureKuboInstalled();
  console.log('✅ Kubo verified and ready\n');
});