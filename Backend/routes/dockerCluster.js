const express = require('express');
const router = express.Router();
const FormData = require('form-data');
const fs = require('fs');
const clusterClient = require('../utils/dockerClusterClient');

// GET /api/docker-cluster/status - Status cluster
router.get('/status', async (req, res) => {
  console.log('[DOCKER-CLUSTER] Obținere status cluster...');
  try {
    const clusterInfo = await clusterClient.getClusterInfo();
    const peers = clusterInfo.peers || [];
    const pinsData = clusterInfo.pins || {};

    console.log('[DOCKER-CLUSTER] pinsData type:', typeof pinsData);
    console.log('[DOCKER-CLUSTER] pinsData is object:', typeof pinsData === 'object');
    console.log('[DOCKER-CLUSTER] pinsData keys count:', Object.keys(pinsData).length);
    console.log('[DOCKER-CLUSTER] pinsData keys:', Object.keys(pinsData));

    // Convertește pins din obiect în array
    let pinsList = [];
    if (Array.isArray(pinsData)) {
      console.log('[DOCKER-CLUSTER] pinsData is array, using directly');
      pinsList = pinsData;
    } else if (typeof pinsData === 'object' && pinsData !== null) {
      console.log('[DOCKER-CLUSTER] pinsData is object, converting to array');
      // Extrage CID-urile și transformă în array de obiecte
      pinsList = Object.entries(pinsData).map(([cid, pinInfo]) => {
        console.log(`[DOCKER-CLUSTER] Processing pin: ${cid}`, pinInfo);
        return {
          cid: cid,
          name: pinInfo.name || 'File',
          ...pinInfo
        };
      });
    }

    console.log(`[DOCKER-CLUSTER] Final pinsList length: ${pinsList.length}`);
    console.log(`[DOCKER-CLUSTER] Final pinsList:`, JSON.stringify(pinsList, null, 2));

    const responseData = {
      success: true,
      cluster: {
        totalNodes: clusterInfo.totalNodes,
        peers: Array.isArray(peers) ? peers.length : 0,
        pinnedFiles: pinsList.length,
        peersList: peers,
        pinsList: pinsList, // Send all pins
        nodesHealth: clusterInfo.nodesHealth,
        nodes: clusterInfo.nodes
      }
    };

    console.log('[DOCKER-CLUSTER] Sending response:', JSON.stringify(responseData, null, 2));
    res.json(responseData);
  } catch (error) {
    console.error('[DOCKER-CLUSTER] Eroare la status:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Cluster-ul nu este disponibil. Asigură-te că Docker Compose rulează.',
      details: error.message 
    });
  }
});

// GET /api/docker-cluster/peers - Lista peers din cluster
router.get('/peers', async (req, res) => {
  console.log('[DOCKER-CLUSTER] Obținere peers...');
  try {
    const peers = await clusterClient.get('/peers');
    
    res.json({
      success: true,
      totalPeers: Array.isArray(peers) ? peers.length : 0,
      peers: peers || []
    });
  } catch (error) {
    console.error('[DOCKER-CLUSTER] Eroare la peers:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/docker-cluster/add - Adaugă fișier în cluster
router.post('/add', async (req, res) => {
  console.log('[DOCKER-CLUSTER] Adăugare fișier în cluster...');
  console.log('[DOCKER-CLUSTER] req.files:', req.files);
  console.log('[DOCKER-CLUSTER] req.body:', req.body);
  
  if (!req.files || !req.files.file) {
    console.error('[DOCKER-CLUSTER] Niciun fișier găsit în request');
    return res.status(400).json({ 
      success: false, 
      error: 'Niciun fișier nu a fost încărcat' 
    });
  }

  const uploadedFile = req.files.file;
  const tempPath = uploadedFile.tempFilePath;

  try {
    // Creează FormData pentru upload
    const form = new FormData();
    form.append('file', fs.createReadStream(tempPath), {
      filename: uploadedFile.name,
      contentType: uploadedFile.mimetype
    });

    console.log(`[DOCKER-CLUSTER] Upload fișier: ${uploadedFile.name} (${uploadedFile.size} bytes)`);
    
    // Trimite fișierul la cluster cu retry logic
    const responseData = await clusterClient.post('/add', form, {
      headers: form.getHeaders(),
      timeout: 60000
    });

    // Extrage CID din răspuns
    const cid = clusterClient.extractCID(responseData);

    if (!cid) {
      console.error('[DOCKER-CLUSTER] Răspuns cluster:', responseData);
      throw new Error('Nu s-a putut extrage CID-ul din răspuns');
    }

    console.log(`[DOCKER-CLUSTER] Fisier adaugat cu CID: ${cid}`);

    // Șterge fișierul temporar
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }

    // Așteaptă 2 secunde pentru replicare
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verifică pe câte noduri e pinuit
    let pinStatus = null;
    let pinnedPeers = 0;
    try {
      pinStatus = await clusterClient.get(`/pins/${cid}`);
      if (pinStatus && pinStatus.peer_map) {
        pinnedPeers = Object.values(pinStatus.peer_map).filter(p => p.status === 'pinned').length;
      }
    } catch (e) {
      console.warn('[DOCKER-CLUSTER] Nu s-a putut obține status pin:', e.message);
    }

    // Generează URL-uri pentru acces
    const gateways = clusterClient.getIPFSGateways();
    const accessUrls = gateways.map(gw => `${gw}/ipfs/${cid}`);

    res.json({
      success: true,
      message: 'Fișier adăugat în cluster cu succes',
      cid: cid,
      file: {
        name: uploadedFile.name,
        cid: cid,
        size: uploadedFile.size,
        mimetype: uploadedFile.mimetype,
        pinnedOn: pinnedPeers,
        allocations: responseData.allocations || [],
        accessUrls: accessUrls,
        addedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[DOCKER-CLUSTER] Eroare la add:', error.message);
    
    // Cleanup
    if (fs.existsSync(tempPath)) {
      try {
        fs.unlinkSync(tempPath);
      } catch (cleanupError) {
        console.error('[DOCKER-CLUSTER] Eroare la cleanup:', cleanupError.message);
      }
    }

    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: 'Verifică că clusterul Docker rulează (docker-compose ps în folderul Infrastructura)'
    });
  }
});

// GET /api/docker-cluster/pins - Lista fișiere pinuite
router.get('/pins', async (req, res) => {
  console.log('[DOCKER-CLUSTER] Obținere listă fișiere pinuite...');
  try {
    const pinsData = await clusterClient.get('/pins');
    
    // IPFS Cluster returnează un obiect unde fiecare CID este o cheie
    // Format: { "QmXXX": {cid, peer_map, ...}, "QmYYY": {...} }
    let cidList = [];
    
    if (pinsData && typeof pinsData === 'object') {
      // Extrage toate cheile care sunt CID-uri IPFS
      cidList = Object.keys(pinsData).filter(key => 
        key.startsWith('Qm') || key.startsWith('baf') || key.startsWith('bafy')
      );
    }
    
    console.log(`[DOCKER-CLUSTER] ${cidList.length} fișiere găsite în cluster`);
    
    res.json({
      success: true,
      totalPins: cidList.length,
      pins: cidList
    });
  } catch (error) {
    console.error('[DOCKER-CLUSTER] Eroare la pins:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/docker-cluster/pin/:cid - Status pin pentru un CID specific
router.get('/pin/:cid', async (req, res) => {
  console.log(`[DOCKER-CLUSTER] Verificare status pin pentru ${req.params.cid}...`);
  try {
    const { cid } = req.params;
    const status = await clusterClient.get(`/pins/${cid}`);
    
    res.json({
      success: true,
      cid: cid,
      replicationCount: Array.isArray(status) ? status.length : 0,
      status: status
    });
  } catch (error) {
    console.error('[DOCKER-CLUSTER] Eroare la pin status:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// DELETE /api/docker-cluster/pin/:cid - Unpin fișier
router.delete('/pin/:cid', async (req, res) => {
  console.log(`[DOCKER-CLUSTER] Unpin fișier ${req.params.cid}...`);
  try {
    const { cid } = req.params;
    await clusterClient.delete(`/pins/${cid}`);
    
    console.log(`[DOCKER-CLUSTER] ✓ Fișier unpinuit: ${cid}`);
    
    res.json({
      success: true,
      message: 'Fișier șters din cluster',
      cid: cid,
      deletedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('[DOCKER-CLUSTER] Eroare la unpin:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/docker-cluster/download/:cid - Download fișier din cluster
router.get('/download/:cid', async (req, res) => {
  console.log(`[DOCKER-CLUSTER] Download fișier ${req.params.cid}...`);
  try {
    const { cid } = req.params;
    const axios = require('axios');
    const gateways = clusterClient.getIPFSGateways();
    
    // Încearcă fiecare gateway până găsește unul funcțional
    let lastError;
    for (const gateway of gateways) {
      try {
        const gatewayUrl = `${gateway}/ipfs/${cid}`;
        console.log(`[DOCKER-CLUSTER] Descărcare de la: ${gatewayUrl}`);
        
        const response = await axios.get(gatewayUrl, {
          responseType: 'stream',
          timeout: 30000,
          validateStatus: (status) => status === 200
        });

        // Extrage filename dacă există în headers
        const contentDisposition = response.headers['content-disposition'];
        let filename = cid;
        if (contentDisposition) {
          const match = contentDisposition.match(/filename="?([^"]+)"?/);
          if (match) filename = match[1];
        }

        // Setează headers pentru download
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
        if (response.headers['content-length']) {
          res.setHeader('Content-Length', response.headers['content-length']);
        }
        
        // Pipe stream către response
        response.data.pipe(res);
        return; // Success - ieșim din funcție
        
      } catch (err) {
        lastError = err;
        console.warn(`[DOCKER-CLUSTER] Gateway ${gateway} indisponibil, încerc următorul...`);
        continue;
      }
    }
    
    // Dacă ajunge aici, niciun gateway nu a funcționat
    throw lastError || new Error('Toate gateway-urile IPFS sunt indisponibile');

  } catch (error) {
    console.error('[DOCKER-CLUSTER] Eroare la download:', error.message);
    
    // Nu trimite JSON dacă headers-ul a fost deja trimis
    if (!res.headersSent) {
      res.status(500).json({ 
        success: false, 
        error: 'Nu s-a putut descărca fișierul',
        details: error.message,
        suggestion: 'Verifică că nodurile IPFS din cluster rulează (docker-compose ps)'
      });
    }
  }
});

// GET /api/docker-cluster/health - Health check cluster
router.get('/health', async (req, res) => {
  console.log('[DOCKER-CLUSTER] Health check...');
  
  try {
    const nodesHealth = await clusterClient.checkAllNodes();
    const nodeStatuses = Object.entries(nodesHealth).map(([node, healthy]) => ({
      url: node,
      status: healthy ? 'online' : 'offline',
      healthy: healthy
    }));

    const onlineNodes = nodeStatuses.filter(n => n.healthy).length;
    const totalNodes = nodeStatuses.length;
    const isHealthy = onlineNodes >= Math.ceil(totalNodes / 2); // Cluster e healthy dacă > 50% noduri sunt online

    res.json({
      success: true,
      health: {
        status: isHealthy ? 'HEALTHY' : (onlineNodes > 0 ? 'DEGRADED' : 'DOWN'),
        totalNodes: totalNodes,
        onlineNodes: onlineNodes,
        offlineNodes: totalNodes - onlineNodes,
        healthPercentage: Math.round((onlineNodes / totalNodes) * 100),
        nodes: nodeStatuses,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('[DOCKER-CLUSTER] Eroare la health check:', error.message);
    res.status(500).json({
      success: false,
      health: {
        status: 'ERROR',
        error: error.message
      }
    });
  }
});

module.exports = router;