const express = require('express');
const router = express.Router();
const fs = require('fs');
const { IPFS_PATH, KUBO_PATH, IPFS_BIN } = require('../config/paths');

router.get('/', (req, res) => {
  console.log('[API] Procesare cerere /api/health...');
  res.json({
    success: true,
    message: 'Server is running',
    ipfsPath: IPFS_PATH,
    kuboPath: KUBO_PATH,
    ipfsExists: fs.existsSync(IPFS_BIN)
  });
});

module.exports = router;
