const express = require('express');
const router = express.Router();
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { execPromise } = require('../utils/execPromise');
const { ensureKuboInstalled } = require('../utils/ensureKuboInstalled');
const { IPFS_PATH, KUBO_PATH, IPFS_BIN } = require('../config/paths');

router.get('/', async (req, res) => {
  try {
    await ensureKuboInstalled();
    const swarmKeyPath = path.join(IPFS_PATH, 'swarm.key');
    if (!fs.existsSync(swarmKeyPath)) {
      return res.status(404).json({ success: false, error: 'swarm.key nu exista' });
    }
    const swarmKeyContent = await fsp.readFile(swarmKeyPath, 'utf8');
    const lines = swarmKeyContent.trim().split('\n');
    const swarmKey = lines[lines.length - 1];
    const idResult = await execPromise(`${IPFS_BIN} id`, { cwd: KUBO_PATH });
    const peerId = JSON.parse(idResult.stdout).ID;
    const ip = process.env.BOOTSTRAP_IP || '192.168.1.104';
    const bootstrapNode = `/ip4/${ip}/tcp/4001/p2p/${peerId}`;
    res.json({ success: true, swarmKey, bootstrapNode });
  } catch (error) {
    res.status(500).json({ success: false, error: error.stderr || error.message });
  }
});

module.exports = router;
