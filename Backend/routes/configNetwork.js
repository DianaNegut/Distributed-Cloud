const express = require('express');
const router = express.Router();
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { execPromise } = require('../utils/execPromise');
const { ensureKuboInstalled } = require('../utils/ensureKuboInstalled');
const { IPFS_PATH, KUBO_PATH } = require('../config/paths');

router.post('/', async (req, res) => {
  await ensureKuboInstalled();
  const { swarmKey, bootstrapNode } = req.body;
  if (!swarmKey || !bootstrapNode) {
    return res.status(400).json({ success: false, error: 'swarmKey si bootstrapNode sunt obligatorii' });
  }
  const logs = [];
  try {
    const swarmKeyContent = `/key/swarm/psk/1.0.0/\n/base16/\n${swarmKey}`;
    const swarmKeyPath = path.join(IPFS_PATH, 'swarm.key');
    await fsp.writeFile(swarmKeyPath, swarmKeyContent, 'utf8');
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
    for (const cmd of cmds) {
      try {
        await execPromise(cmd, { cwd: KUBO_PATH });
        logs.push({ message: `✓ Executat: ${cmd}`, type: 'info' });
      } catch (cmdError) {
        const errorMsg = cmdError.stderr || cmdError.message || 'Eroare necunoscuta';
        logs.push({ message: `✗ Esuat: ${cmd} - ${errorMsg}`, type: 'error' });
        console.error(`[CONFIGURE-NETWORK] Eroare la: ${cmd}`, errorMsg);
        throw new Error(`Comanda esuata: ${cmd} - ${errorMsg}`);
      }
    }
    logs.push({ message: 'Retea IPFS configurata cu succes!', type: 'success' });
    res.json({ success: true, logs });
  } catch (error) {
    const errorDetails = error.stderr || error.message || 'Eroare necunoscuta';
    logs.push({ message: `Eroare: ${errorDetails}`, type: 'error' });
    console.error('[CONFIGURE-NETWORK] Eroare generala:', errorDetails);
    res.status(500).json({ 
      success: false, 
      logs,
      error: errorDetails,
      suggestion: 'Verifica ca daemon-ul IPFS ruleaza: ipfs daemon'
    });
  }
});

module.exports = router;
