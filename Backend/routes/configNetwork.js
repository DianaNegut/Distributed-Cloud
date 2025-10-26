const express = require('express');
const router = express.Router();
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { execPromise } = require('../utils/execPromise');
const { ensureKuboInstalled } = require('../utils/ensureKuboInstalled');
const { IPFS_PATH, KUBO_PATH } = require('../config/paths');

router.post('/', async (req, res) => {
  console.log('[API] Procesare cerere /api/configure-network...');
  await ensureKuboInstalled();

  const { swarmKey, bootstrapNode } = req.body;
  if (!swarmKey || !bootstrapNode) {
    console.warn('[CONFIG] swarmKey sau bootstrapNode lipsesc.');
    return res.status(400).json({ success: false, error: 'swarmKey și bootstrapNode sunt obligatorii' });
  }

  const logs = [];

  try {
    const swarmKeyContent = `/key/swarm/psk/1.0.0/\n/base16/\n${swarmKey}`;
    const swarmKeyPath = path.join(IPFS_PATH, 'swarm.key');
    await fsp.writeFile(swarmKeyPath, swarmKeyContent, 'utf8');
    console.log(`[CONFIG] swarm.key scris la ${swarmKeyPath}`);
    logs.push({ message: 'swarm.key scris cu succes', type: 'success' });

    const cmds = [
      'ipfs config --json AutoConf.Enabled false',
      'ipfs config --json AutoTLS.Enabled false',
      'ipfs config Routing.Type dht',
      'ipfs config --json Routing.DelegatedRouters "[]"',
      'ipfs config --json Ipns.DelegatedPublishers "[]"',
      'ipfs bootstrap rm --all',
      `ipfs bootstrap add ${bootstrapNode}`
    ];

    console.log('[CONFIG] Se execută comenzile IPFS...');
    for (const cmd of cmds) {
      await execPromise(cmd, { cwd: KUBO_PATH });
      logs.push({ message: `Executat: ${cmd}`, type: 'info' });
    }

    console.log('[CONFIG]  Rețea IPFS configurată cu succes!');
    logs.push({ message: ' Rețea IPFS configurată cu succes!', type: 'success' });
    res.json({ success: true, logs });
  } catch (error) {
    console.error('[CONFIG]  Eroare la configurarea rețelei:', error.stderr || error.message);
    logs.push({ message: ` Eroare: ${error.error || error.message}`, type: 'error' });
    res.status(500).json({ success: false, logs });
  }
});

module.exports = router;
