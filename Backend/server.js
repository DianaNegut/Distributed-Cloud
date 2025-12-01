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
const networkInfoRoutes = require('./routes/networkInfo');
const storageProvidersRoutes = require('./routes/storageProviders');
const storageContractsRoutes = require('./routes/storageContracts');

const app = express();
const PORT = process.env.PORT || 3001;


app.use(cors(corsConfig));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));


const os = require('os');
app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: os.tmpdir(),
  limits: { fileSize: 100 * 1024 * 1024 }, 
  abortOnLimit: true,
  debug: true
}));

app.use(logger);


app.use('/api/health', healthRoutes);
app.use('/api/bootstrap-info', bootstrapRoutes);
app.use('/api/join-network', joinRoutes);


app.use(auth);
app.use('/api/status', statusRoutes);
app.use('/api/peers', peersRoutes);
app.use('/api/configure-network', configNetworkRoutes);
app.use('/api/files', filesRoutes);
app.use('/api/cluster', clusterRoutes);
app.use('/api/docker-cluster', dockerClusterRoutes);
app.use('/api/network-info', networkInfoRoutes);
app.use('/api/storage-providers', storageProvidersRoutes);
app.use('/api/storage-contracts', storageContractsRoutes);


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

app.listen(PORT, () => {
  console.log(`\n[SERVER] Pornit pe http://localhost:${PORT}`);
  console.log(`[SERVER] API disponibil la http://localhost:${PORT}/api`);
  console.log(`[SERVER] API Key: ${process.env.API_KEY || 'supersecret'}\n`);
});