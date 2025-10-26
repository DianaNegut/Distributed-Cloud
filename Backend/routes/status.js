const express = require('express');
const router = express.Router();
const { execPromise } = require('../utils/execPromise');
const { ensureKuboInstalled } = require('../utils/ensureKuboInstalled');
const { KUBO_PATH } = require('../config/paths');

router.get('/', async (req, res) => {
  console.log('[API] Procesare cerere /api/status...');
  try {
    await ensureKuboInstalled();
    console.log('[STATUS] Se rulează `ipfs id`...');
    const result = await execPromise('ipfs id', { cwd: KUBO_PATH });
    res.json({ success: true, data: JSON.parse(result.stdout) });
  } catch (error) {
    console.error('[STATUS]  Eroare la `ipfs id`:', error.stderr || error.message);
    res.status(500).json({ success: false, error: error.error || error.message });
  }
});

module.exports = router;
