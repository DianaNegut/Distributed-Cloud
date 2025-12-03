const express = require('express');
const router = express.Router();
const { ensureKuboInstalled } = require('../utils/ensureKuboInstalled');
const fetch = require('node-fetch');

router.post('/', async (req, res) => {
  try {
    await ensureKuboInstalled();
    const axios = require('axios');
    const PORT = process.env.PORT || 3001;
    const apiUrl = `http://${process.env.BOOTSTRAP_IP || '192.168.1.104'}:${PORT}/api/bootstrap-info`;
    const { data } = await axios.get(apiUrl);
    if (!data.success) throw new Error('Nu s-au putut obtine detaliile de retea');
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
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
