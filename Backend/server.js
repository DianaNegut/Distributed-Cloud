require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fileUpload = require('express-fileupload');

const corsConfig = require('./middleware/corsConfig');
const logger = require('./middleware/logger');
const auth = require('./middleware/auth');

const healthRoutes = require('./routes/health');
const statusRoutes = require('./routes/status');
const bootstrapRoutes = require('./routes/bootstrap');
const joinRoutes = require('./routes/join');
const filesRoutes = require('./routes/files');
const dockerClusterRoutes = require('./routes/dockerCluster');
const networkInfoRoutes = require('./routes/networkInfo');
const storageProvidersRoutes = require('./routes/storageProviders');
const storageContractsRoutes = require('./routes/storageContracts');
const userStorageRoutes = require('./routes/userStorage');
const filecoinRoutes = require('./routes/filecoin');
const solidRoutes = require('./routes/solid');
const authRoutes = require('./routes/auth');
const didRoutes = require('./routes/did');
const { router: integrityRoutes, integrityVerifier } = require('./routes/integrity');
const { router: failoverRoutes, failoverManager, setupFailoverWebSocket } = require('./routes/failover');
const ethereumRoutes = require('./routes/ethereum');
const fileAccessRoutes = require('./routes/fileAccess');
const providerAgentRoutes = require('./routes/providerAgent');

const filecoinService = require('./services/filecoinService');

const app = express();
const PORT = process.env.PORT || 3001;
const os = require('os');

app.use(cors(corsConfig));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: os.tmpdir(),
  limits: { fileSize: 100 * 1024 * 1024 },
  abortOnLimit: true,
  debug: false
}));
app.use(logger);

app.use('/api/health', healthRoutes);
app.use('/api/bootstrap-info', bootstrapRoutes);
app.use('/api/join-network', joinRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/provider-agent', providerAgentRoutes); // Provider Agent communication (no auth)

app.use(auth);
const DockerClusterClient = require('./utils/dockerClusterClient');
const peersClient = new DockerClusterClient();

app.get('/api/peers', async (req, res) => {
  try {
    const clusterInfo = await peersClient.getClusterInfo();
    res.json({
      success: true,
      peers: clusterInfo.peers || [],
      totalPeers: (clusterInfo.peers || []).length
    });
  } catch (error) {
    console.error('[PEERS] Error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.use('/api/files', filesRoutes);
app.use('/api/cluster', dockerClusterRoutes);
app.use('/api/docker-cluster', dockerClusterRoutes); // Frontend uses this path
app.use('/api/network-info', networkInfoRoutes);
app.use('/api/storage-providers', storageProvidersRoutes);
app.use('/api/storage-contracts', storageContractsRoutes);
app.use('/api/user-storage', userStorageRoutes);
app.use('/api/filecoin', filecoinRoutes);
app.use('/api/solid', solidRoutes);
app.use('/api/did', didRoutes);
app.use('/api/integrity', integrityRoutes);
app.use('/api/failover', failoverRoutes);
app.use('/api/ethereum', ethereumRoutes);
app.use('/api/file-access', fileAccessRoutes);

app.use((err, req, res, next) => {
  console.error('[ERROR]', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found'
  });
});

const server = app.listen(PORT, async () => {
  console.log(`\n[SERVER] Pornit pe http://localhost:${PORT}`);
  console.log(`[SERVER] API disponibil la http://localhost:${PORT}/api`);
  console.log(`[SERVER] API Key: ${process.env.API_KEY || 'supersecret'}\n`);

  // ========================================
  // Inițializare Provider WebSocket Server
  // ========================================
  try {
    const providerSocketServer = require('./websocket/providerSocket');
    providerSocketServer.initialize(server);
    console.log('[SERVER] Provider WebSocket server initialized');
    console.log(`[SERVER] WebSocket endpoint: ws://localhost:${PORT}/provider-ws\n`);
  } catch (error) {
    console.error('[SERVER] Provider WebSocket initialization failed:', error.message);
    console.error('[SERVER] Stack:', error.stack);
    console.log('[SERVER] Continuing without WebSocket support...\n');
  }

  // Inițializare Filecoin service
  try {
    await filecoinService.initialize();
    console.log('[SERVER] Filecoin service initialized\n');
  } catch (error) {
    console.error('[SERVER] Filecoin initialization failed:', error.message);
  }

  // Inițializare DID System
  try {
    console.log('[SERVER] Decentralized Identity (DID) system initialized');
    console.log(`[SERVER] DID API available at http://localhost:${PORT}/api/did\n`);
  } catch (error) {
    console.error('[SERVER] DID initialization failed:', error.message);
  }

  // Inițializare Integrity Verifier cu scheduler
  try {
    const INTEGRITY_CHECK_INTERVAL = process.env.INTEGRITY_CHECK_INTERVAL_HOURS || 24;
    integrityVerifier.startPeriodicChecks(INTEGRITY_CHECK_INTERVAL * 60 * 60 * 1000);
    console.log(`[SERVER] Data Integrity Verifier initialized`);
    console.log(`[SERVER] Periodic checks every ${INTEGRITY_CHECK_INTERVAL} hours`);

    // Start auto-repair replication monitoring
    const REPLICATION_CHECK_INTERVAL = process.env.REPLICATION_CHECK_INTERVAL_MINUTES || 30;
    const MIN_REPLICAS = process.env.MIN_REPLICAS || 3;
    integrityVerifier.startReplicationMonitoring(
      REPLICATION_CHECK_INTERVAL * 60 * 1000,
      MIN_REPLICAS
    );
    console.log(`[SERVER] Auto-repair monitoring enabled: ${REPLICATION_CHECK_INTERVAL}min intervals, min ${MIN_REPLICAS} replicas\n`);
  } catch (error) {
    console.error('[SERVER] Integrity Verifier initialization failed:', error.message);
  }

  // Inițializare Failover Manager
  try {
    const FAILOVER_CHECK_INTERVAL = process.env.FAILOVER_CHECK_INTERVAL_SECONDS || 30;
    failoverManager.startHealthMonitoring(FAILOVER_CHECK_INTERVAL * 1000);
    console.log(`[SERVER] Failover Manager initialized`);
    console.log(`[SERVER] Health checks every ${FAILOVER_CHECK_INTERVAL} seconds\n`);
  } catch (error) {
    console.error('[SERVER] Failover Manager initialization failed:', error.message);
  }

  // Inițializare Ethereum Smart Contracts
  try {
    console.log('[SERVER] Ethereum Smart Contracts integration initialized');
    console.log(`[SERVER] Network: ${process.env.ETHEREUM_NETWORK || 'sepolia-testnet'}`);
    console.log(`[SERVER] Ethereum API available at http://localhost:${PORT}/api/ethereum\n`);
  } catch (error) {
    console.error('[SERVER] Ethereum integration failed:', error.message);
  }
});