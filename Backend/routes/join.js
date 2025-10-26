const express = require('express');
const router = express.Router();
const { ensureKuboInstalled } = require('../utils/ensureKuboInstalled');
const fetch = require('node-fetch');

router.post('/', async (req, res) => {
  console.log('[API] Procesare cerere /api/join-network...');
  try {
    await ensureKuboInstalled();

    const axios = require('axios');
    const PORT = process.env.PORT || 3001;
    const apiUrl = `http://${process.env.BOOTSTRAP_IP || '192.168.1.104'}:${PORT}/api/bootstrap-info`;

    console.log(`[JOIN] Se contactează serverul bootstrap la: ${apiUrl}`);
    const { data } = await axios.get(apiUrl);

    if (!data.success) throw new Error('Nu s-au putut obține detaliile de rețea');

    console.log('[JOIN] Date primite de la bootstrap. Se configurează rețeaua local...');
    const { swarmKey, bootstrapNode } = data;

    const configureResponse = await fetch(`http://localhost:${PORT}/api/configure-network`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.API_KEY || 'supersecret'
      },
      body: JSON.stringify({ swarmKey, bootstrapNode })
    });

    const result = await configureResponse.json();
    console.log('[JOIN] Configurare finalizată.');
    res.json(result);
  } catch (error) {
    console.error(' Eroare la /api/join-network:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
