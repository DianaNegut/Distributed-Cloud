const express = require('express');
const router = express.Router();
const { execPromise } = require('../utils/execPromise');
const { ensureKuboInstalled } = require('../utils/ensureKuboInstalled');
const { KUBO_PATH } = require('../config/paths');

router.get('/', async (req, res) => {
  try {
    await ensureKuboInstalled();
    const result = await execPromise('ipfs id', { cwd: KUBO_PATH });
    res.json({ success: true, data: JSON.parse(result.stdout) });
  } catch (error) {
    res.status(500).json({ success: false, error: error.error || error.message });
  }
});

module.exports = router;
