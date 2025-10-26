require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { ensureKuboInstalled } = require('./utils/ensureKuboInstalled');
const { IPFS_PATH, KUBO_PATH, IPFS_BIN } = require('./config/paths');

// Middleware-uri
const corsConfig = require('./middleware/corsConfig');
const logger = require('./middleware/logger');
const auth = require('./middleware/auth');

// Rute
const bootstrapRoutes = require('./routes/bootstrap');
const joinRoutes = require('./routes/join');
const configNetworkRoutes = require('./routes/configNetwork');
const statusRoutes = require('./routes/status');
const peersRoutes = require('./routes/peers');
const healthRoutes = require('./routes/health');

const app = express();
const PORT = process.env.PORT || 3001;

// Middleware global
app.use(cors(corsConfig));
app.use(express.json());
app.use(logger);
app.use(auth);

// Rute API
app.use('/api/bootstrap-info', bootstrapRoutes);
app.use('/api/join-network', joinRoutes);
app.use('/api/configure-network', configNetworkRoutes);
app.use('/api/status', statusRoutes);
app.use('/api/peers', peersRoutes);
app.use('/api/health', healthRoutes);

// Pornire server
app.listen(PORT, async () => {
  console.log(`Server pornit pe http://localhost:${PORT}`);
  console.log(`IPFS Path: ${IPFS_PATH}`);
  console.log(`Kubo Path: ${KUBO_PATH}`);
  await ensureKuboInstalled();
  console.log(`Health check: http://localhost:${PORT}/api/health`);
});
