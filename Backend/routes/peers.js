const express = require('express');
const router = express.Router();
const { execPromise } = require('../utils/execPromise');
const { ensureKuboInstalled } = require('../utils/ensureKuboInstalled');
const { KUBO_PATH } = require('../config/paths');

router.get('/', async (req, res) => {
  console.log('[API] Procesare cerere /api/peers...');
  try {
    // Folosește containerul Docker ipfs-node-1 pentru a obține peers
    console.log('[PEERS] Se rulează `docker exec ipfs-node-1 ipfs swarm peers`...');
    const result = await execPromise('docker exec ipfs-node-1 ipfs swarm peers');

    const peers = result.stdout.split('\n').filter(p => p.trim());
    console.log(`[PEERS] Găsiți ${peers.length} peers.`);
    res.json({ success: true, peers });
  } catch (error) {
    console.error('[PEERS] Eroare la `docker exec ipfs swarm peers`:', error.stderr || error.message);
    res.status(500).json({ success: false, error: error.stderr || error.message });
  }
});

module.exports = router;
