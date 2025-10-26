const express = require('express');
const router = express.Router();
const { execPromise } = require('../utils/execPromise');
const { ensureKuboInstalled } = require('../utils/ensureKuboInstalled');
const { KUBO_PATH } = require('../config/paths');

router.get('/', async (req, res) => {
  console.log('[API] Procesare cerere /api/peers...');
  try {
    await ensureKuboInstalled();

    let result;
    try {
      console.log('[PEERS] Se rulează `ipfs swarm peers`...');
      result = await execPromise('ipfs swarm peers', { cwd: KUBO_PATH });
    } catch (error) {
      if (error.stderr && error.stderr.includes("ipfs daemon")) {
        console.log('⚙️ IPFS daemon oprit — pornim automat...');
        await execPromise('start "" ipfs daemon', { cwd: KUBO_PATH });
        console.log('[PEERS] Se așteaptă 7 secunde pornirea daemon-ului...');
        await new Promise(r => setTimeout(r, 7000));
        console.log('[PEERS] Se reîncearcă `ipfs swarm peers`...');
        result = await execPromise('ipfs swarm peers', { cwd: KUBO_PATH });
      } else {
        throw error;
      }
    }

    const peers = result.stdout.split('\n').filter(p => p.trim());
    console.log(`[PEERS] Găsiți ${peers.length} peers.`);
    res.json({ success: true, peers });
  } catch (error) {
    console.error('[PEERS] ❌ Eroare la `ipfs swarm peers`:', error.stderr || error.message);
    res.status(500).json({ success: false, error: error.stderr || error.message });
  }
});

module.exports = router;
