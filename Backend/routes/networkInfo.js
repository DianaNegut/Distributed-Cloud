const express = require('express');
const router = express.Router();
const { execPromise } = require('../utils/execPromise');

/**
 * GET /api/network-info
 * Returnează configurația rețelei private pentru ca utilizatorii să se poată alătura
 */
router.get('/', async (req, res) => {
  console.log('[NETWORK-INFO] Cerere pentru informații rețea privată...');
  
  try {
    // Swarm key din variabilă de mediu
    const swarmKey = process.env.SWARM_KEY || 'ddd244b4b304dca4d8947b4444a1d76223334cfdafd674263b0b600feae39cbe';
    
    // Obține peer ID de la primul nod Docker IPFS
    let bootstrapNode = '';
    try {
      const result = await execPromise('docker exec ipfs-node-1 ipfs id -f="<id>"');
      const peerId = result.stdout.trim();
      
      // Detectează IP-ul public sau folosește localhost
      const publicIP = process.env.PUBLIC_IP || 'localhost';
      bootstrapNode = `/ip4/${publicIP}/tcp/4001/p2p/${peerId}`;
      
      console.log(`[NETWORK-INFO] Bootstrap node: ${bootstrapNode}`);
    } catch (error) {
      console.error('[NETWORK-INFO] Nu s-a putut obține peer ID din container:', error.message);
      // Fallback la valoare default
      bootstrapNode = process.env.BOOTSTRAP_NODE || '/ip4/localhost/tcp/4001/p2p/12D3KooWQWwEb4DrNcW85vsp5brhxQaRk6bennUHYqMbMVDnABXV';
    }

    const networkConfig = {
      swarmKey,
      bootstrapNode,
      networkName: 'Distributed-Cloud Private Network',
      clusterNodes: 5,
      instructions: [
        '1. Asigură-te că ai IPFS (kubo) instalat',
        '2. Creează fișierul swarm.key în ~/.ipfs/',
        '3. Configurează bootstrap node-ul',
        '4. Repornește daemon-ul IPFS'
      ]
    };

    res.json({
      success: true,
      network: networkConfig
    });
  } catch (error) {
    console.error('[NETWORK-INFO] Eroare:', error.message);
    res.status(500).json({
      success: false,
      error: 'Nu s-au putut obține informațiile rețelei',
      details: error.message
    });
  }
});

module.exports = router;
