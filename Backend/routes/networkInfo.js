const express = require('express');
const router = express.Router();
const { execPromise } = require('../utils/execPromise');

router.get('/', async (req, res) => {
  try {
    const swarmKey = process.env.SWARM_KEY || 'ddd244b4b304dca4d8947b4444a1d76223334cfdafd674263b0b600feae39cbe';
    let isPrivateNetworkActive = false;
    let swarmKeyExists = false;
    let autoConfDisabled = false;
    
    try {
      await execPromise('docker exec ipfs-node-1 test -f /data/ipfs/swarm.key');
      swarmKeyExists = true;
      const autoConfResult = await execPromise('docker exec ipfs-node-1 ipfs config AutoConf.Enabled');
      autoConfDisabled = autoConfResult.stdout.trim() === 'false';
      isPrivateNetworkActive = swarmKeyExists && autoConfDisabled;
    } catch (error) {
    }
    
    let bootstrapNode = '';
    try {
      const result = await execPromise('docker exec ipfs-node-1 ipfs id -f="<id>"');
      const peerId = result.stdout.trim();
      const publicIP = process.env.PUBLIC_IP || '127.0.0.1';  
      bootstrapNode = `/ip4/${publicIP}/tcp/4001/p2p/${peerId}`;
    } catch (error) {
      bootstrapNode = process.env.BOOTSTRAP_NODE || '/ip4/127.0.0.1/tcp/4001/p2p/12D3KooWQWwEb4DrNcW85vsp5brhxQaRk6bennUHYqMbMVDnABXV';
    }
    
    const networkConfig = {
      swarmKey,
      bootstrapNode,
      networkName: 'Distributed-Cloud Private Network',
      clusterNodes: 5,
      isActive: isPrivateNetworkActive,
      status: {
        swarmKeyExists,
        autoConfDisabled
      },
      instructions: [
        '1. Asigura-te ca ai IPFS (kubo) instalat',
        '2. Creeaza fisierul swarm.key in ~/.ipfs/',
        '3. Configureaza bootstrap node-ul',
        '4. Reporneste daemon-ul IPFS'
      ]
    };
    
    res.json({
      success: true,
      network: networkConfig
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Nu s-au putut obtine informatiile retelei',
      details: error.message
    });
  }
});

module.exports = router;
