const express = require('express');
const router = express.Router();
const { execPromise } = require('../utils/execPromise');
const { ensureKuboInstalled } = require('../utils/ensureKuboInstalled');
const { KUBO_PATH } = require('../config/paths');

router.get('/', async (req, res) => {
  try {
    const result = await execPromise('docker exec ipfs-node-1 ipfs swarm peers');
    const peers = result.stdout.split('\n').filter(p => p.trim());
    res.json({ success: true, peers });
  } catch (error) {
    res.status(500).json({ success: false, error: error.stderr || error.message });
  }
});

module.exports = router;
