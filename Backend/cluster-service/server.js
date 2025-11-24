require('dotenv').config();
const express = require('express');
const fileUpload = require('express-fileupload');
const os = require('os');
const clusterClient = require('../utils/dockerClusterClient');
const FormData = require('form-data');
const fs = require('fs');

const app = express();
const PORT = process.env.CLUSTER_SERVICE_PORT || 4002;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({
  useTempFiles: true,
  tempFileDir: os.tmpdir(),
  limits: { fileSize: 100 * 1024 * 1024 },
  abortOnLimit: true
}));

// Health endpoint
app.get('/health', (req, res) => {
  res.json({ success: true, service: 'cluster-service', timestamp: new Date().toISOString() });
});

// Peers
app.get('/peers', async (req, res) => {
  try {
    const peers = await clusterClient.get('/peers');
    res.json({ success: true, totalPeers: Array.isArray(peers) ? peers.length : 0, peers });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Pins list
app.get('/pins', async (req, res) => {
  try {
    const pinsData = await clusterClient.get('/pins');
    let cidList = [];
    if (pinsData && typeof pinsData === 'object') {
      cidList = Object.keys(pinsData).filter(key => key.startsWith('Qm') || key.startsWith('baf'));
    }
    res.json({ success: true, totalPins: cidList.length, pins: cidList });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Pin status single CID
app.get('/pin/:cid', async (req, res) => {
  try {
    const status = await clusterClient.get(`/pins/${req.params.cid}`);
    res.json({ success: true, cid: req.params.cid, status });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Add file
app.post('/add', async (req, res) => {
  if (!req.files || !req.files.file) {
    return res.status(400).json({ success: false, error: 'No file uploaded' });
  }
  const uploadedFile = req.files.file;
  const tempPath = uploadedFile.tempFilePath;
  try {
    const form = new FormData();
    form.append('file', fs.createReadStream(tempPath), { filename: uploadedFile.name, contentType: uploadedFile.mimetype });
    const responseData = await clusterClient.post('/add', form, { headers: form.getHeaders(), timeout: 60000 });
    const cid = clusterClient.extractCID(responseData);
    if (!cid) throw new Error('CID not found in cluster response');
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    await new Promise(r => setTimeout(r, 1500));
    let pinnedPeers = 0; let pinStatus = null;
    try { pinStatus = await clusterClient.get(`/pins/${cid}`); if (pinStatus?.peer_map) pinnedPeers = Object.values(pinStatus.peer_map).filter(p => p.status === 'pinned').length; } catch {}
    const gateways = clusterClient.getIPFSGateways();
    const accessUrls = gateways.map(g => `${g}/ipfs/${cid}`);
    res.json({ success: true, cid, file: { cid, name: uploadedFile.name, size: uploadedFile.size, mimetype: uploadedFile.mimetype, pinnedOn: pinnedPeers, accessUrls, addedAt: new Date().toISOString() } });
  } catch (e) {
    if (fs.existsSync(tempPath)) { try { fs.unlinkSync(tempPath); } catch {} }
    res.status(500).json({ success: false, error: e.message });
  }
});

// Delete pin
app.delete('/pin/:cid', async (req, res) => {
  try {
    await clusterClient.delete(`/pins/${req.params.cid}`);
    res.json({ success: true, cid: req.params.cid, deletedAt: new Date().toISOString() });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
});

// Download passthrough
app.get('/download/:cid', async (req, res) => {
  const { cid } = req.params;
  const axios = require('axios');
  const gateways = clusterClient.getIPFSGateways();
  let lastError;
  for (const gw of gateways) {
    try {
      const url = `${gw}/ipfs/${cid}`;
      const response = await axios.get(url, { responseType: 'stream', timeout: 30000, validateStatus: s => s === 200 });
      res.setHeader('Content-Disposition', `attachment; filename="${cid}"`);
      res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
      response.data.pipe(res); return;
    } catch (err) { lastError = err; continue; }
  }
  if (!res.headersSent) res.status(500).json({ success: false, error: lastError?.message || 'All gateways failed' });
});

// Cluster status aggregate
app.get('/status', async (req, res) => {
  try {
    const info = await clusterClient.getClusterInfo();
    const pinsList = Array.isArray(info.pins) ? info.pins : Object.keys(info.pins || {}).map(cid => ({ cid }));
    res.json({ success: true, cluster: { totalNodes: info.totalNodes, peers: Array.isArray(info.peers) ? info.peers.length : 0, pinnedFiles: pinsList.length, peersList: info.peers, pinsList, nodesHealth: info.nodesHealth, nodes: info.nodes } });
  } catch (e) { res.status(500).json({ success: false, error: e.message }); }
});

function start(port, attemptsLeft = 5) {
  const server = app.listen(port, () => {
    console.log(`[CLUSTER-SERVICE] Listening on http://localhost:${port}`);
  });
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`[CLUSTER-SERVICE] Port ${port} already in use.`);
      if (attemptsLeft > 0) {
        const nextPort = Number(port) + 1;
        console.log(`[CLUSTER-SERVICE] Retrying on port ${nextPort} (remaining attempts: ${attemptsLeft - 1})`);
        start(nextPort, attemptsLeft - 1);
      } else {
        console.error('[CLUSTER-SERVICE] No free port found. Set CLUSTER_SERVICE_PORT in .env to an available port.');
        process.exit(1);
      }
    } else {
      console.error('[CLUSTER-SERVICE] Server error:', err);
      process.exit(1);
    }
  });
}

start(PORT);
