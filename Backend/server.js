require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fileUpload = require('express-fileupload');

const corsConfig = require('./middleware/corsConfig');
const logger = require('./middleware/logger');
const auth = require('./middleware/auth');

const healthRoutes = require('./routes/health');
const statusRoutes = require('./routes/status');
const peersRoutes = require('./routes/peers');
const bootstrapRoutes = require('./routes/bootstrap');
const joinRoutes = require('./routes/join');
const configNetworkRoutes = require('./routes/configNetwork');
const filesRoutes = require('./routes/files');
const clusterRoutes = require('./routes/cluster');
const dockerClusterRoutes = require('./routes/dockerCluster');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors(corsConfig));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Middleware pentru upload fișiere
app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: '/tmp/',
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  abortOnLimit: true
}));

app.use(logger);

// Routes publice (fără autentificare)
app.use('/api/health', healthRoutes);
app.use('/api/bootstrap-info', bootstrapRoutes);
app.use('/api/join-network', joinRoutes);

// Routes cu autentificare
app.use(auth);
app.use('/api/status', statusRoutes);
app.use('/api/peers', peersRoutes);
app.use('/api/configure-network', configNetworkRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/cluster', clusterRoutes);
app.use('/api/docker-cluster', dockerClusterRoutes); // RUTĂ NOUĂ PENTRU DOCKER CLUSTER

// Error handling
app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(500).json({ 
    success: false, 
    error: err.message || 'Internal server error' 
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ 
    success: false, 
    error: 'Endpoint not found' 
  });
});

app.listen(PORT, () => {
  console.log(`\n[SERVER] Pornit pe http://localhost:${PORT}`);
  console.log(`[SERVER] API disponibil la http://localhost:${PORT}/api`);
  console.log(`[SERVER] API Key: ${process.env.API_KEY || 'supersecret'}\n`);
});