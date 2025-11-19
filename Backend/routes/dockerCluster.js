const express = require('express');
const router = express.Router();
const axios = require('axios');
const FormData = require('form-data');
const fs = require('fs');

// Adresele nodurilor din cluster Docker
const CLUSTER_NODES = [
  'http://localhost:9094',  // Node 1
  'http://localhost:9194',  // Node 2
  'http://localhost:9294',  // Node 3
  'http://localhost:9394',  // Node 4
  'http://localhost:9494'   // Node 5
];

// Helper function - selectează un nod disponibil
async function getAvailableNode() {
  for (const node of CLUSTER_NODES) {
    try {
      await axios.get(`${node}/health`, { timeout: 2000 });
      return node;
    } catch (error) {
      continue;
    }
  }
  throw new Error('Niciun nod din cluster nu este disponibil');
}

// GET /api/docker-cluster/status - Status cluster
router.get('/status', async (req, res) => {
  console.log('[DOCKER-CLUSTER] Obținere status cluster...');
  try {
    const node = await getAvailableNode();
    
    // Obține lista de peers din cluster
    const peersResponse = await axios.get(`${node}/peers`);
    const peers = peersResponse.data || [];

    // Obține lista de fișiere pinuite
    const pinsResponse = await axios.get(`${node}/pins`);
    const pins = pinsResponse.data || [];

    res.json({
      success: true,
      cluster: {
        totalNodes: CLUSTER_NODES.length,
        activeNode: node,
        peers: peers.length,
        pinnedFiles: Array.isArray(pins) ? pins.length : 0,
        peersList: peers,
        nodes: CLUSTER_NODES
      }
    });
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
    const node = await getAvailableNode();
    const response = await axios.get(`${node}/peers`);
    
    res.json({
      success: true,
      peers: response.data || []
    });
  } catch (error) {
    console.error('[DOCKER-CLUSTER] Eroare la peers:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/docker-cluster/add - Adaugă fișier în cluster
router.post('/add', async (req, res) => {
  console.log('[DOCKER-CLUSTER] Adăugare fișier în cluster...');
  
  if (!req.files || !req.files.file) {
    return res.status(400).json({ 
      success: false, 
      error: 'Niciun fișier nu a fost încărcat' 
    });
  }

  const uploadedFile = req.files.file;
  const tempPath = uploadedFile.tempFilePath;

  try {
    const node = await getAvailableNode();
    
    // Creează FormData pentru upload
    const form = new FormData();
    form.append('file', fs.createReadStream(tempPath), {
      filename: uploadedFile.name,
      contentType: uploadedFile.mimetype
    });

    console.log(`[DOCKER-CLUSTER] Upload către ${node}/add...`);
    
    // Trimite fișierul la cluster
    const response = await axios.post(`${node}/add`, form, {
      headers: {
        ...form.getHeaders()
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 60000
    });

    // Extrage CID din răspuns
    let cid = null;
    if (response.data) {
      const cidMatch = JSON.stringify(response.data).match(/Qm[a-zA-Z0-9]{44,}/);
      if (cidMatch) {
        cid = cidMatch[0];
      }
    }

    if (!cid) {
      throw new Error('Nu s-a putut extrage CID-ul din răspuns');
    }

    console.log(`[DOCKER-CLUSTER] ✓ Fișier adăugat cu CID: ${cid}`);

    // Șterge fișierul temporar
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }

    // Așteaptă 3 secunde pentru replicare
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Verifică pe câte noduri e pinuit
    let pinStatus = [];
    try {
      const statusResponse = await axios.get(`${node}/pins/${cid}`);
      pinStatus = statusResponse.data;
    } catch (e) {
      console.warn('[DOCKER-CLUSTER] Nu s-a putut obține status pin');
    }

    res.json({
      success: true,
      message: 'Fișier adăugat în cluster cu succes',
      file: {
        name: uploadedFile.name,
        cid: cid,
        size: uploadedFile.size,
        mimetype: uploadedFile.mimetype,
        pinStatus: pinStatus,
        addedAt: new Date().toISOString()
      }
    });

  } catch (error) {
    console.error('[DOCKER-CLUSTER] Eroare la add:', error.message);
    
    // Cleanup
    if (fs.existsSync(tempPath)) {
      fs.unlinkSync(tempPath);
    }

    res.status(500).json({ 
      success: false, 
      error: error.message,
      details: error.response?.data || 'Eroare necunoscută'
    });
  }
});

// GET /api/docker-cluster/pins - Lista fișiere pinuite
router.get('/pins', async (req, res) => {
  console.log('[DOCKER-CLUSTER] Obținere listă fișiere pinuite...');
  try {
    const node = await getAvailableNode();
    const response = await axios.get(`${node}/pins`);
    
    const pins = response.data || [];
    
    res.json({
      success: true,
      totalPins: Array.isArray(pins) ? pins.length : 0,
      pins: pins
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
    const node = await getAvailableNode();
    
    const response = await axios.get(`${node}/pins/${cid}`);
    
    res.json({
      success: true,
      cid: cid,
      status: response.data
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
    const node = await getAvailableNode();
    
    await axios.delete(`${node}/pins/${cid}`);
    
    console.log(`[DOCKER-CLUSTER] ✓ Fișier unpinuit: ${cid}`);
    
    res.json({
      success: true,
      message: 'Fișier șters din cluster',
      cid: cid
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
    
    // Găsește un gateway IPFS disponibil
    const gatewayUrl = `http://localhost:8080/ipfs/${cid}`;
    
    console.log(`[DOCKER-CLUSTER] Descărcare de la: ${gatewayUrl}`);
    
    const response = await axios.get(gatewayUrl, {
      responseType: 'stream',
      timeout: 30000
    });

    // Setează headers pentru download
    res.setHeader('Content-Disposition', `attachment; filename="${cid}"`);
    res.setHeader('Content-Type', response.headers['content-type'] || 'application/octet-stream');
    
    // Pipe stream către response
    response.data.pipe(res);

  } catch (error) {
    console.error('[DOCKER-CLUSTER] Eroare la download:', error.message);
    res.status(500).json({ 
      success: false, 
      error: 'Nu s-a putut descărca fișierul',
      details: error.message 
    });
  }
});

// GET /api/docker-cluster/health - Health check cluster
router.get('/health', async (req, res) => {
  console.log('[DOCKER-CLUSTER] Health check...');
  
  const nodeStatuses = [];
  
  for (const node of CLUSTER_NODES) {
    try {
      const response = await axios.get(`${node}/health`, { timeout: 2000 });
      nodeStatuses.push({
        url: node,
        status: 'online',
        healthy: true
      });
    } catch (error) {
      nodeStatuses.push({
        url: node,
        status: 'offline',
        healthy: false,
        error: error.message
      });
    }
  }

  const onlineNodes = nodeStatuses.filter(n => n.healthy).length;
  const isHealthy = onlineNodes >= 3; // Cluster e healthy dacă minim 3 noduri sunt online

  res.json({
    success: true,
    health: {
      status: isHealthy ? 'HEALTHY' : 'DEGRADED',
      totalNodes: CLUSTER_NODES.length,
      onlineNodes: onlineNodes,
      offlineNodes: CLUSTER_NODES.length - onlineNodes,
      nodes: nodeStatuses,
      timestamp: new Date().toISOString()
    }
  });
});

module.exports = router;